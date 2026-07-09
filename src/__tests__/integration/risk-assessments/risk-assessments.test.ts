/**
 * Integração das Server Actions de Avaliação de Risco contra Postgres efêmero.
 * Mocka o gate de papel, a URL do banco (app runtime → efêmero) e next/cache.
 */
import type postgres from "postgres";

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
  listRiskAssessmentsAction,
  getRiskAssessmentAction,
  getCurrentRiskAssessmentAction,
  createRiskAssessmentAction,
  updateRiskAssessmentAction,
  deleteRiskAssessmentAction,
} from "@/shared/server/actions/pgr/risk-assessments";
import type { RiskAssessmentInput } from "@/shared/domains/pgr/risk-assessment";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;

function asOwner(tenantId: string) {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
}

const RANDOM_UUID = "99999999-9999-9999-9999-999999999999";

function createInput(overrides: Partial<RiskAssessmentInput> = {}): RiskAssessmentInput {
  return {
    criterion: "quantitative",
    probability: 3,
    severity: 3,
    uncertaintyDegree: 0,
    assessedAt: "2026-07-08",
    ...overrides,
  };
}

(shouldRun ? describe : describe.skip)("Server Actions — risk_assessments", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });

  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
    mockedGate.mockReset();
    asOwner("org_a");
  });

  it("list retorna as avaliações do risco do tenant (seed = 1)", async () => {
    const result = await listRiskAssessmentsAction(PGR_IDS.riskA, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(1);
      expect(result.data.rows[0].id).toBe(PGR_IDS.riskAssessmentA);
    }
  });

  it("get por id retorna a avaliação do tenant", async () => {
    const result = await getRiskAssessmentAction(PGR_IDS.riskAssessmentA);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.riskId).toBe(PGR_IDS.riskA);
  });

  it("create calcula e persiste riskLevel (=prob×sev) e result (snapshot)", async () => {
    const created = await createRiskAssessmentAction(PGR_IDS.riskA, createInput());
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.data.riskLevel).toBe(9);
      expect(created.data.result).toBe("moderate"); // metodologia padrão: 9 ≤ 12
    }
  });

  it("getCurrent retorna a mais recente por assessedAt", async () => {
    await createRiskAssessmentAction(
      PGR_IDS.riskA,
      createInput({ probability: 5, severity: 5, assessedAt: "2026-08-01" }),
    );
    const current = await getCurrentRiskAssessmentAction(PGR_IDS.riskA);
    expect(current.ok).toBe(true);
    if (current.ok && current.data) {
      expect(current.data.assessedAt).toBe("2026-08-01");
      expect(current.data.riskLevel).toBe(25);
    }
  });

  it("reavaliação cria nova linha (histórico 1:N, sem 409)", async () => {
    await createRiskAssessmentAction(PGR_IDS.riskA, createInput());
    const list = await listRiskAssessmentsAction(PGR_IDS.riskA, {});
    expect(list.ok && list.data.total).toBe(2);
  });

  it("update de corpo completo recalcula riskLevel e result", async () => {
    const result = await updateRiskAssessmentAction(
      PGR_IDS.riskA,
      PGR_IDS.riskAssessmentA,
      createInput({ probability: 5, severity: 5 }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.riskLevel).toBe(25);
      expect(result.data.result).toBe("intolerable");
    }
  });

  it("delete remove e get seguinte → NOT_FOUND", async () => {
    const del = await deleteRiskAssessmentAction(PGR_IDS.riskA, PGR_IDS.riskAssessmentA);
    expect(del.ok).toBe(true);
    const after = await getRiskAssessmentAction(PGR_IDS.riskAssessmentA);
    expect(!after.ok && after.error.code).toBe("NOT_FOUND");
  });

  it("riskId inválido → FK_NOT_FOUND (create/list/current)", async () => {
    const create = await createRiskAssessmentAction(RANDOM_UUID, createInput());
    expect(!create.ok && create.error.code).toBe("FK_NOT_FOUND");
    const list = await listRiskAssessmentsAction(RANDOM_UUID, {});
    expect(!list.ok && list.error.code).toBe("FK_NOT_FOUND");
    const current = await getCurrentRiskAssessmentAction(RANDOM_UUID);
    expect(!current.ok && current.error.code).toBe("FK_NOT_FOUND");
  });

  it("riskId de outro tenant → FK_NOT_FOUND", async () => {
    const result = await createRiskAssessmentAction(PGR_IDS.riskB, createInput());
    expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
  });

  it("avaliação de outro tenant (get/update/delete) → NOT_FOUND", async () => {
    const get = await getRiskAssessmentAction(PGR_IDS.riskAssessmentB);
    expect(!get.ok && get.error.code).toBe("NOT_FOUND");
    const upd = await updateRiskAssessmentAction(
      PGR_IDS.riskB,
      PGR_IDS.riskAssessmentB,
      createInput(),
    );
    expect(!upd.ok && upd.error.code).toBe("NOT_FOUND");
    const del = await deleteRiskAssessmentAction(PGR_IDS.riskB, PGR_IDS.riskAssessmentB);
    expect(!del.ok && del.error.code).toBe("NOT_FOUND");
  });

  it("validação (probability fora de 1–5) → VALIDATION", async () => {
    const result = await createRiskAssessmentAction(
      PGR_IDS.riskA,
      createInput({ probability: 9 }),
    );
    expect(!result.ok && result.error.code).toBe("VALIDATION");
  });

  it("lista de org_a não vaza avaliação de org_b", async () => {
    const result = await listRiskAssessmentsAction(PGR_IDS.riskA, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rows.every((r) => r.id !== PGR_IDS.riskAssessmentB)).toBe(true);
    }
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockReset();
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await listRiskAssessmentsAction(PGR_IDS.riskA, {});
    expect(!result.ok && result.error.code).toBe("FORBIDDEN");
  });
});
