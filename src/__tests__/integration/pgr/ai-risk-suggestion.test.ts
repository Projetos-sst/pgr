import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));
// O único ponto de rede (LLM) é substituído por mock: a persistência/isolamento/cota
// são exercidos contra o Postgres efêmero sem chamar a API externa.
jest.mock("@/shared/integrations/agents", () => ({
  requestRiskSuggestions: jest.fn(),
  requestRiskFill: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError } from "@/shared/auth/errors";
import { requestRiskFill, requestRiskSuggestions } from "@/shared/integrations/agents";
import {
  acceptSuggestedRisks,
  fillRisk,
  suggestRisks,
} from "@/shared/server/actions/pgr/ai-risk-suggestion";
import {
  AI_RISK_SUGGESTION_KIND,
  type SuggestedRisk,
} from "@/shared/domains/pgr/ai-risk-suggestion";
import { FREE_AI_SUGGESTION_MONTHLY_QUOTA } from "@/shared/tenant/plan";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const mockedModel = requestRiskSuggestions as jest.MockedFunction<
  typeof requestRiskSuggestions
>;

const mockedFill = jest.mocked(requestRiskFill);

const asOwner = (tenantId: string, plan: "free" | "pro" = "free") =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan, role: "owner" });

const TWO: SuggestedRisk[] = [
  { agentType: "physical", description: "IA Ruído contínuo" },
  { agentType: "chemical", description: "IA Poeira de sílica", sources: "Lixadeira" },
];

async function countUsage(
  admin: ReturnType<typeof postgres>,
  orgId: string,
): Promise<number> {
  const [row] = await admin<{ c: number }[]>`
    select count(*)::int as c from public.ai_usage_events where org_id = ${orgId}`;
  return row.c;
}

async function countRisksLike(
  admin: ReturnType<typeof postgres>,
  gesId: string,
  prefix: string,
): Promise<number> {
  const [row] = await admin<{ c: number }[]>`
    select count(*)::int as c from public.risks
    where ges_id = ${gesId} and description like ${prefix + "%"}`;
  return row.c;
}

(shouldRun ? describe : describe.skip)(
  "Server Actions — ai-risk-suggestion (US1)",
  () => {
    let admin: ReturnType<typeof postgres>;

    beforeAll(async () => {
      admin = adminClient();
      await applyMigrations(admin);
    });

    afterAll(async () => {
      await admin.end();
    });

    beforeEach(async () => {
      await seedPgrBase(admin);
      mockedGate.mockReset();
      mockedModel.mockReset();
      mockedFill.mockReset();
      asOwner("org_a");
    });

    it("suggest: happy path devolve sugestões e registra 1 uso", async () => {
      mockedModel.mockResolvedValue(TWO);
      const res = await suggestRisks(PGR_IDS.gesA);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.suggestions).toHaveLength(2);
      expect(mockedModel).toHaveBeenCalledTimes(1);
      expect(await countUsage(admin, "org_a")).toBe(1);
    });

    it("suggest: GES de outra org → FK_NOT_FOUND, sem chamar o LLM nem registrar uso", async () => {
      const res = await suggestRisks(PGR_IDS.gesB); // org_a pedindo gesB
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("FK_NOT_FOUND");
      expect(mockedModel).not.toHaveBeenCalled();
      expect(await countUsage(admin, "org_a")).toBe(0);
    });

    it("suggest: cota do plano free estourada → QUOTA_EXCEEDED, sem chamar o LLM", async () => {
      await admin.unsafe(
        `insert into public.ai_usage_events (org_id, kind)
         select 'org_a', '${AI_RISK_SUGGESTION_KIND}'
         from generate_series(1, ${FREE_AI_SUGGESTION_MONTHLY_QUOTA})`,
      );
      const res = await suggestRisks(PGR_IDS.gesA);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("QUOTA_EXCEEDED");
      expect(mockedModel).not.toHaveBeenCalled();
    });

    it("suggest: plano pro ignora a cota", async () => {
      await admin.unsafe(
        `insert into public.ai_usage_events (org_id, kind)
         select 'org_a', '${AI_RISK_SUGGESTION_KIND}'
         from generate_series(1, ${FREE_AI_SUGGESTION_MONTHLY_QUOTA + 10})`,
      );
      asOwner("org_a", "pro");
      mockedModel.mockResolvedValue(TWO);
      const res = await suggestRisks(PGR_IDS.gesA);
      expect(res.ok).toBe(true);
      expect(mockedModel).toHaveBeenCalledTimes(1);
    });

    it("suggest: papel client → FORBIDDEN", async () => {
      mockedGate.mockRejectedValue(new ForbiddenError());
      const res = await suggestRisks(PGR_IDS.gesA);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
    });

    it("accept: persiste os selecionados como rascunho em risks (reusa createRisk)", async () => {
      const res = await acceptSuggestedRisks(PGR_IDS.gesA, { suggestions: TWO });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.created).toBe(2);
      expect(await countRisksLike(admin, PGR_IDS.gesA, "IA ")).toBe(2);
    });

    it("accept: GES de outra org → FK_NOT_FOUND, nada persiste em org_b", async () => {
      const res = await acceptSuggestedRisks(PGR_IDS.gesB, { suggestions: TWO });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("FK_NOT_FOUND");
      expect(await countRisksLike(admin, PGR_IDS.gesB, "IA ")).toBe(0);
    });

    it("accept: lista vazia → VALIDATION", async () => {
      const res = await acceptSuggestedRisks(PGR_IDS.gesA, { suggestions: [] });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("VALIDATION");
    });
    it("accept: grava os campos novos editados pelo usuário", async () => {
      const res = await acceptSuggestedRisks(PGR_IDS.gesA, {
        suggestions: [
          {
            agentType: "physical",
            description: "IA Ruído editado",
            propagation: "Via aérea",
            possibleInjuries: "PAIR",
            exposureTime: "habitual",
          },
        ],
      });
      expect(res.ok).toBe(true);
      const [row] = await admin<
        { propagation: string; possible_injuries: string; exposure_time: string }[]
      >`select propagation, possible_injuries, exposure_time from public.risks
        where ges_id = ${PGR_IDS.gesA} and description = 'IA Ruído editado'`;
      expect(row).toEqual({
        propagation: "Via aérea",
        possible_injuries: "PAIR",
        exposure_time: "habitual",
      });
    });

    it("fill: devolve 1 risco completo, manda o foco ao agente e registra 1 uso", async () => {
      mockedFill.mockResolvedValue([
        {
          agentType: "physical",
          description: "Ruído da serra",
          propagation: "Via aérea",
          possibleInjuries: "PAIR",
          exposureTime: "habitual",
        },
        { agentType: "chemical", description: "Ignorado" },
      ]);
      const res = await fillRisk(PGR_IDS.gesA, { description: "Ruído da serra" });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.risk).toEqual(
          expect.objectContaining({
            description: "Ruído da serra",
            exposureTime: "habitual",
          }),
        );
      }
      expect(mockedFill).toHaveBeenCalledWith(expect.any(Object), {
        description: "Ruído da serra",
      });
      expect(await countUsage(admin, "org_a")).toBe(1);
    });

    it("fill: mantém o grupo do agente escolhido pelo usuário", async () => {
      mockedFill.mockResolvedValue([{ agentType: "chemical", description: "Ruído" }]);
      const res = await fillRisk(PGR_IDS.gesA, { agentType: "physical" });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.risk?.agentType).toBe("physical");
    });

    it("fill: IA sem resposta útil → risk null e sem consumir cota", async () => {
      mockedFill.mockResolvedValue([]);
      const res = await fillRisk(PGR_IDS.gesA, {});
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.risk).toBeNull();
      expect(await countUsage(admin, "org_a")).toBe(0);
    });

    it("fill: GES de outra org → FK_NOT_FOUND, sem chamar o LLM", async () => {
      const res = await fillRisk(PGR_IDS.gesB, {});
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("FK_NOT_FOUND");
      expect(mockedFill).not.toHaveBeenCalled();
    });

    it("fill: cota do plano free estourada → QUOTA_EXCEEDED, sem chamar o LLM", async () => {
      await admin.unsafe(
        `insert into public.ai_usage_events (org_id, kind)
         select 'org_a', '${AI_RISK_SUGGESTION_KIND}'
         from generate_series(1, ${FREE_AI_SUGGESTION_MONTHLY_QUOTA})`,
      );
      const res = await fillRisk(PGR_IDS.gesA, {});
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("QUOTA_EXCEEDED");
      expect(mockedFill).not.toHaveBeenCalled();
    });

    it("fill: foco com grupo inválido → VALIDATION", async () => {
      const res = await fillRisk(PGR_IDS.gesA, { agentType: "cosmic" });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("VALIDATION");
      expect(mockedFill).not.toHaveBeenCalled();
    });
  },
);
