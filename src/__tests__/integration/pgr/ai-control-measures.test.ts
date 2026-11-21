import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));
jest.mock("@/shared/integrations/agents", () => ({
  requestControlMeasureSuggestions: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { requestControlMeasureSuggestions } from "@/shared/integrations/agents";
import { AI_CONTROL_MEASURE_KIND } from "@/shared/domains/pgr/ai-control-measure-suggestion";
import {
  acceptSuggestedControlMeasures,
  suggestControlMeasures,
} from "@/shared/server/actions/pgr/ai-control-measures";
import { FREE_AI_SUGGESTION_MONTHLY_QUOTA } from "@/shared/tenant/plan";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const shouldRun =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;

const mockedGate = jest.mocked(requireOfficeStaff);
const mockedModel = jest.mocked(requestControlMeasureSuggestions);

const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

async function countUsage(admin: ReturnType<typeof postgres>): Promise<number> {
  const [row] = await admin<{ c: number }[]>`
    select count(*)::int as c from public.ai_usage_events
    where org_id = 'org_a' and kind = ${AI_CONTROL_MEASURE_KIND}`;
  return row.c;
}

async function measuresOfRiskA(admin: ReturnType<typeof postgres>) {
  return admin<
    {
      control_level: string;
      action_what: string | null;
      action_why: string | null;
      action_responsible: string | null;
    }[]
  >`select control_level, action_what, action_why, action_responsible
    from public.control_measures where risk_id = ${PGR_IDS.riskA} order by control_level`;
}

const edited = {
  controlLevel: "collective_protection",
  actionWhat: "Enclausurar revisado",
  actionWhy: "Reduzir o ruído na fonte",
  actionHow: "Instalar cabine acústica",
};

(shouldRun ? describe : describe.skip)("Server Actions — ai-control-measures", () => {
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

  it("suggest: devolve medidas com o porquê, sem o nível já cadastrado, e registra 1 uso", async () => {
    mockedModel.mockResolvedValue([
      { controlLevel: "elimination", actionWhat: "Eliminar", actionHow: "Trocar" },
      { ...edited, controlLevel: "collective_protection" },
    ]);
    const res = await suggestControlMeasures(PGR_IDS.riskA);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.existingLevels).toEqual(["elimination"]);
      expect(res.data.suggestions.map((s) => s.controlLevel)).toEqual([
        "collective_protection",
      ]);
      expect(res.data.suggestions[0]?.actionWhy).toBe("Reduzir o ruído na fonte");
    }
    expect(await countUsage(admin)).toBe(1);
  });

  it("suggest: risco de outra org → FK_NOT_FOUND, sem chamar a IA nem gastar cota", async () => {
    const res = await suggestControlMeasures(PGR_IDS.riskB);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FK_NOT_FOUND");
    expect(mockedModel).not.toHaveBeenCalled();
    expect(await countUsage(admin)).toBe(0);
  });

  it("suggest: cota do plano free estourada → QUOTA_EXCEEDED, sem chamar a IA", async () => {
    await admin.unsafe(
      `insert into public.ai_usage_events (org_id, kind)
       select 'org_a', '${AI_CONTROL_MEASURE_KIND}'
       from generate_series(1, ${FREE_AI_SUGGESTION_MONTHLY_QUOTA})`,
    );
    const res = await suggestControlMeasures(PGR_IDS.riskA);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("QUOTA_EXCEEDED");
    expect(mockedModel).not.toHaveBeenCalled();
  });

  it("accept: grava os valores editados na revisão, inclusive o porquê", async () => {
    const res = await acceptSuggestedControlMeasures(PGR_IDS.riskA, {
      suggestions: [edited],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.created).toBe(1);
    expect(await measuresOfRiskA(admin)).toContainEqual({
      control_level: "collective_protection",
      action_what: "Enclausurar revisado",
      action_why: "Reduzir o ruído na fonte",
      action_responsible: null,
    });
  });

  it("accept: risco de outra org → FK_NOT_FOUND e nada gravado", async () => {
    const res = await acceptSuggestedControlMeasures(PGR_IDS.riskB, {
      suggestions: [edited],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FK_NOT_FOUND");
    const [row] = await admin<{ c: number }[]>`
      select count(*)::int as c from public.control_measures where risk_id = ${PGR_IDS.riskB}`;
    expect(row.c).toBe(1);
  });

  it("accept: nível já cadastrado → VALIDATION sem gravar parte do lote", async () => {
    const res = await acceptSuggestedControlMeasures(PGR_IDS.riskA, {
      suggestions: [edited, { ...edited, controlLevel: "elimination" }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION");
    expect(await measuresOfRiskA(admin)).toHaveLength(1);
  });

  it("accept: risco moderado sem responsável e prazo → VALIDATION; com eles grava", async () => {
    await admin`update public.risk_assessments set result = 'moderate'
      where id = ${PGR_IDS.riskAssessmentA}`;
    const missing = await acceptSuggestedControlMeasures(PGR_IDS.riskA, {
      suggestions: [edited],
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("VALIDATION");

    const res = await acceptSuggestedControlMeasures(PGR_IDS.riskA, {
      suggestions: [
        { ...edited, actionResponsible: "SESMT", actionDeadline: "2026-12-31" },
      ],
    });
    expect(res.ok).toBe(true);
    expect(await measuresOfRiskA(admin)).toContainEqual(
      expect.objectContaining({ action_responsible: "SESMT" }),
    );
  });
});
