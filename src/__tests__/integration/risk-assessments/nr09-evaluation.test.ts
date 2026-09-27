/**
 * Integração da avaliação quantitativa NR-09 (#39) contra Postgres efêmero: persistência
 * do bloco, CHECKs do banco, elegibilidade por agente (regra de servidor), conclusão
 * humana preservada, isolamento por tenant e RLS.
 */
import postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError } from "@/shared/auth/errors";
import {
  createRiskAssessmentAction,
  getCurrentRiskAssessmentAction,
  listRiskAssessmentsAction,
  updateRiskAssessmentAction,
} from "@/shared/server/actions/pgr/risk-assessments";
import type { RiskAssessmentInput } from "@/shared/domains/pgr/risk-assessment";

import { adminClient, applyMigrations, withOrgTx } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;

function asOwner(tenantId: string) {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
}

/** Risco ergonômico do org_a — fora do escopo da NR-09. */
const ERGONOMIC_RISK = "11111111-1111-1111-1111-1111111111f9";

function nr09Input(overrides: Partial<RiskAssessmentInput> = {}): RiskAssessmentInput {
  return {
    criterion: "quantitative",
    probability: 3,
    severity: 3,
    uncertaintyDegree: 0,
    assessedAt: "2026-09-27",
    toleranceLimit: "NR-15 Anexo 1 — 85 dB(A) para 8h",
    evaluationMethod: "NHO-01 (ruído)",
    measuredValue: "87.5",
    measuredUnit: "db_a",
    toleranceLimitValue: "85",
    nr09Conclusion: "above_limit",
    ...overrides,
  };
}

(shouldRun ? describe : describe.skip)("NR-09 — avaliação quantitativa (#39)", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    // Conexão como `app_runtime` (RLS ENFORCED). `appRuntimeClient()` do helper aponta
    // para INTEGRATION_DATABASE_URL, que nesta suíte é o superusuário — bypassaria RLS.
    runtime = postgres(APP_RUNTIME_URL!, { max: 1, prepare: false });
    await applyMigrations(admin);
  });

  afterAll(async () => {
    await runtime.end({ timeout: 5 });
    await admin.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
    await admin.unsafe(`
      insert into public.risks (id, org_id, ges_id, agent_type, description) values
        ('${ERGONOMIC_RISK}','org_a','${PGR_IDS.gesA}','ergonomic','Postura em bancada');
    `);
    mockedGate.mockReset();
    asOwner("org_a");
  });

  it("persiste o bloco completo e devolve na avaliação vigente", async () => {
    const created = await createRiskAssessmentAction(PGR_IDS.riskA, nr09Input());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.evaluationMethod).toBe("NHO-01 (ruído)");
    expect(created.data.measuredUnit).toBe("db_a");
    expect(created.data.nr09Conclusion).toBe("above_limit");
    expect(Number(created.data.measuredValue)).toBe(87.5);
    expect(Number(created.data.toleranceLimitValue)).toBe(85);

    const current = await getCurrentRiskAssessmentAction(PGR_IDS.riskA);
    expect(current.ok && current.data?.nr09Conclusion).toBe("above_limit");
  });

  it("lista traz os campos NR-09 do histórico", async () => {
    await createRiskAssessmentAction(PGR_IDS.riskA, nr09Input());
    const list = await listRiskAssessmentsAction(PGR_IDS.riskA, {});
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const withMeasurement = list.data.rows.find((r) => r.nr09Conclusion !== null);
    expect(withMeasurement?.evaluationMethod).toBe("NHO-01 (ruído)");
    expect(withMeasurement?.measuredUnit).toBe("db_a");
  });

  it("conclusão informada é preservada mesmo contrariando a sugestão", async () => {
    // Medição abaixo do limite, mas o profissional conclui "acima" (dose, picos, jornada).
    const created = await createRiskAssessmentAction(
      PGR_IDS.riskA,
      nr09Input({ measuredValue: "80", nr09Conclusion: "above_limit" }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.nr09Conclusion).toBe("above_limit");

    const [row] = await admin.unsafe(
      `select nr09_conclusion from public.risk_assessments where id = '${created.data.id}'`,
    );
    expect(row.nr09_conclusion).toBe("above_limit");
  });

  it("update limpa o bloco quando os campos voltam vazios", async () => {
    const created = await createRiskAssessmentAction(PGR_IDS.riskA, nr09Input());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateRiskAssessmentAction(
      PGR_IDS.riskA,
      created.data.id,
      nr09Input({
        evaluationMethod: "",
        measuredValue: "",
        measuredUnit: "",
        toleranceLimitValue: "",
        nr09Conclusion: "",
      }),
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.evaluationMethod).toBeNull();
    expect(updated.data.measuredValue).toBeNull();
    expect(updated.data.nr09Conclusion).toBeNull();
  });

  it("agente não contemplado pela NR-09 → VALIDATION (regra do servidor)", async () => {
    const result = await createRiskAssessmentAction(ERGONOMIC_RISK, nr09Input());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(result.error.message).toContain("NR-09");
  });

  it("avaliação qualitativa com bloco NR-09 → VALIDATION", async () => {
    const result = await createRiskAssessmentAction(
      PGR_IDS.riskA,
      nr09Input({ criterion: "qualitative" }),
    );
    expect(!result.ok && result.error.code).toBe("VALIDATION");
  });

  it("valor medido sem unidade → VALIDATION", async () => {
    const result = await createRiskAssessmentAction(
      PGR_IDS.riskA,
      nr09Input({ measuredUnit: "" }),
    );
    expect(!result.ok && result.error.code).toBe("VALIDATION");
  });

  it("CHECK do banco recusa medição sem unidade mesmo por INSERT direto", async () => {
    await expect(
      admin.unsafe(`
        insert into public.risk_assessments
          (org_id, risk_id, criterion, probability, severity, risk_level, assessed_at, measured_value)
        values ('org_a','${PGR_IDS.riskA}','quantitative',3,3,9,'2026-09-27',87.5)
      `),
    ).rejects.toThrow(/risk_assessments_measured_unit_check/);
  });

  it("CHECK do banco recusa bloco NR-09 em critério qualitativo", async () => {
    await expect(
      admin.unsafe(`
        insert into public.risk_assessments
          (org_id, risk_id, criterion, probability, severity, risk_level, assessed_at, evaluation_method)
        values ('org_a','${PGR_IDS.riskA}','qualitative',3,3,9,'2026-09-27','NHO-01')
      `),
    ).rejects.toThrow(/risk_assessments_quantitative_criterion_check/);
  });

  it("risco de outro tenant → FK_NOT_FOUND, sem gravar nada", async () => {
    const result = await createRiskAssessmentAction(PGR_IDS.riskB, nr09Input());
    expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
    const [row] = await admin.unsafe(
      `select count(*)::int as total from public.risk_assessments
       where risk_id = '${PGR_IDS.riskB}' and evaluation_method is not null`,
    );
    expect(row.total).toBe(0);
  });

  it("RLS: org_b não enxerga a medição de org_a", async () => {
    const created = await createRiskAssessmentAction(PGR_IDS.riskA, nr09Input());
    expect(created.ok).toBe(true);

    const visible = await withOrgTx(
      runtime,
      "org_b",
      (tx) =>
        tx`select id, evaluation_method from public.risk_assessments where evaluation_method is not null`,
    );
    expect(visible).toHaveLength(0);
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockReset();
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await createRiskAssessmentAction(PGR_IDS.riskA, nr09Input());
    expect(!result.ok && result.error.code).toBe("FORBIDDEN");
  });
});
