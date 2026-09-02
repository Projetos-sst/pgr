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
jest.mock("@/shared/integrations/agents/risk-suggestion/agent", () => ({
  requestRiskSuggestions: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError } from "@/shared/auth/errors";
import { requestRiskSuggestions } from "@/shared/integrations/agents/risk-suggestion/agent";
import {
  acceptSuggestedRisks,
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
  },
);
