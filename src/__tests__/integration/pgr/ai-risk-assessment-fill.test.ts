import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));
jest.mock("@/shared/integrations/agents", () => ({
  requestRiskAssessmentFill: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { requestRiskAssessmentFill } from "@/shared/integrations/agents";
import {
  AI_RISK_ASSESSMENT_FILL_KIND,
  type FilledRiskAssessment,
} from "@/shared/domains/pgr/ai-risk-assessment-fill";
import { fillRiskAssessmentAction } from "@/shared/server/actions/pgr/risk-assessments";
import { FREE_AI_SUGGESTION_MONTHLY_QUOTA } from "@/shared/tenant/plan";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const shouldRun =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;

const mockedGate = jest.mocked(requireOfficeStaff);
const mockedModel = jest.mocked(requestRiskAssessmentFill);

const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const quantitative: FilledRiskAssessment = {
  criterion: "quantitative",
  probability: 4,
  severity: 3,
  evaluationMethod: "NHO-01",
  justification: "Exposição habitual ao ruído da prensa.",
};

async function countUsage(admin: ReturnType<typeof postgres>): Promise<number> {
  const [row] = await admin<{ c: number }[]>`
    select count(*)::int as c from public.ai_usage_events
    where org_id = 'org_a' and kind = ${AI_RISK_ASSESSMENT_FILL_KIND}`;
  return row.c;
}

(shouldRun ? describe : describe.skip)("Server Actions — ai-risk-assessment-fill", () => {
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

  it("sem medição no risco: força qualitativo, tira o método, manda contexto sem medição e registra 1 uso", async () => {
    mockedModel.mockResolvedValue(quantitative);
    const res = await fillRiskAssessmentAction(PGR_IDS.riskA);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.assessment).toEqual({
        ...quantitative,
        criterion: "qualitative",
        evaluationMethod: null,
      });
    }
    expect(mockedModel).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Ruído contínuo",
        hasMeasuredValue: false,
        nr09Eligible: true,
      }),
    );
    expect(await countUsage(admin)).toBe(1);
  });

  it("com medição registrada no risco: mantém o quantitativo e o método", async () => {
    await admin`update public.risks set concentration_intensity = 92 where id = ${PGR_IDS.riskA}`;
    mockedModel.mockResolvedValue(quantitative);
    const res = await fillRiskAssessmentAction(PGR_IDS.riskA);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.assessment).toEqual(quantitative);
  });

  it("IA sem resposta aproveitável: devolve null e não gasta cota", async () => {
    mockedModel.mockResolvedValue(null);
    const res = await fillRiskAssessmentAction(PGR_IDS.riskA);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.assessment).toBeNull();
    expect(await countUsage(admin)).toBe(0);
  });

  it("risco de outra org → FK_NOT_FOUND, sem chamar a IA nem gastar cota", async () => {
    const res = await fillRiskAssessmentAction(PGR_IDS.riskB);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FK_NOT_FOUND");
    expect(mockedModel).not.toHaveBeenCalled();
    expect(await countUsage(admin)).toBe(0);
  });

  it("cota do plano free estourada → QUOTA_EXCEEDED, sem chamar a IA", async () => {
    await admin.unsafe(
      `insert into public.ai_usage_events (org_id, kind)
       select 'org_a', '${AI_RISK_ASSESSMENT_FILL_KIND}'
       from generate_series(1, ${FREE_AI_SUGGESTION_MONTHLY_QUOTA})`,
    );
    const res = await fillRiskAssessmentAction(PGR_IDS.riskA);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("QUOTA_EXCEEDED");
    expect(mockedModel).not.toHaveBeenCalled();
  });

  it("não grava avaliação nenhuma: o preenchimento só volta para a revisão", async () => {
    mockedModel.mockResolvedValue(quantitative);
    const [before] = await admin<{ c: number }[]>`
      select count(*)::int as c from public.risk_assessments where risk_id = ${PGR_IDS.riskA}`;
    await fillRiskAssessmentAction(PGR_IDS.riskA);
    const [after] = await admin<{ c: number }[]>`
      select count(*)::int as c from public.risk_assessments where risk_id = ${PGR_IDS.riskA}`;
    expect(after.c).toBe(before.c);
  });
});
