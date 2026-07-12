/**
 * Integração das Server Actions de Medidas de Controle (control_measures) contra Postgres
 * efêmero. Mocka o gate de papel, a URL do banco (app runtime → efêmero) e next/cache.
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
  listControlMeasuresAction,
  getControlMeasureAction,
  createControlMeasureAction,
  updateControlMeasureAction,
  deleteControlMeasureAction,
} from "@/shared/server/actions/pgr/control-measures";
import type { ControlMeasureInput } from "@/shared/domains/pgr/control-measure";

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

/** Nível não usado pelo seed (controlMeasureA = elimination@riskA). */
function createInput(overrides: Partial<ControlMeasureInput> = {}): ControlMeasureInput {
  return {
    controlLevel: "collective_protection",
    applicable: false,
    ...overrides,
  };
}

(shouldRun ? describe : describe.skip)("Server Actions — control_measures", () => {
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

  it("list retorna as medidas do risco do tenant (seed = 1)", async () => {
    const result = await listControlMeasuresAction(PGR_IDS.riskA, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(1);
      expect(result.data.rows[0].id).toBe(PGR_IDS.controlMeasureA);
      expect(result.data.rows[0].controlLevel).toBe("elimination");
    }
  });

  it("get por id retorna a medida do tenant", async () => {
    const result = await getControlMeasureAction(PGR_IDS.controlMeasureA);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.riskId).toBe(PGR_IDS.riskA);
  });

  it("create persiste nível + campos 5W2H", async () => {
    const created = await createControlMeasureAction(
      PGR_IDS.riskA,
      createInput({
        applicable: true,
        actionWhat: "Enclausuramento",
        actionHow: "Projeto acústico",
        actionResponsible: "Maria Souza",
        actionDeadline: "2026-09-30",
      }),
    );
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.data.controlLevel).toBe("collective_protection");
      expect(created.data.applicable).toBe(true);
      expect(created.data.actionWhat).toBe("Enclausuramento");
      expect(created.data.actionResponsible).toBe("Maria Souza");
      expect(created.data.actionDeadline).toBe("2026-09-30");
    }
  });

  it("create de nível já existente no risco → DUPLICATE (UNIQUE)", async () => {
    // controlMeasureA já é elimination@riskA.
    const result = await createControlMeasureAction(
      PGR_IDS.riskA,
      createInput({ controlLevel: "elimination" }),
    );
    expect(!result.ok && result.error.code).toBe("DUPLICATE");
  });

  it("update de corpo completo (não altera control_level; imutável)", async () => {
    const result = await updateControlMeasureAction(
      PGR_IDS.riskA,
      PGR_IDS.controlMeasureA,
      createInput({
        controlLevel: "ppe", // deve ser ignorado — nível é imutável
        applicable: true,
        actionWhat: "Substituir por processo úmido",
        actionHow: "Reengenharia",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.controlLevel).toBe("elimination"); // permaneceu
      expect(result.data.applicable).toBe(true);
      expect(result.data.actionWhat).toBe("Substituir por processo úmido");
    }
  });

  it("delete remove e get seguinte → NOT_FOUND; libera o nível", async () => {
    const del = await deleteControlMeasureAction(PGR_IDS.riskA, PGR_IDS.controlMeasureA);
    expect(del.ok).toBe(true);
    const after = await getControlMeasureAction(PGR_IDS.controlMeasureA);
    expect(!after.ok && after.error.code).toBe("NOT_FOUND");
    // Nível liberado: recriar elimination agora funciona.
    const recreate = await createControlMeasureAction(
      PGR_IDS.riskA,
      createInput({ controlLevel: "elimination" }),
    );
    expect(recreate.ok).toBe(true);
  });

  it("riskId inválido → FK_NOT_FOUND (create/list)", async () => {
    const create = await createControlMeasureAction(RANDOM_UUID, createInput());
    expect(!create.ok && create.error.code).toBe("FK_NOT_FOUND");
    const list = await listControlMeasuresAction(RANDOM_UUID, {});
    expect(!list.ok && list.error.code).toBe("FK_NOT_FOUND");
  });

  it("riskId de outro tenant → FK_NOT_FOUND", async () => {
    const result = await createControlMeasureAction(PGR_IDS.riskB, createInput());
    expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
  });

  it("medida de outro tenant (get/update/delete) → NOT_FOUND", async () => {
    const get = await getControlMeasureAction(PGR_IDS.controlMeasureB);
    expect(!get.ok && get.error.code).toBe("NOT_FOUND");
    const upd = await updateControlMeasureAction(
      PGR_IDS.riskB,
      PGR_IDS.controlMeasureB,
      createInput(),
    );
    expect(!upd.ok && upd.error.code).toBe("NOT_FOUND");
    const del = await deleteControlMeasureAction(PGR_IDS.riskB, PGR_IDS.controlMeasureB);
    expect(!del.ok && del.error.code).toBe("NOT_FOUND");
  });

  it("validação (applicable=true sem actionWhat/actionHow) → VALIDATION", async () => {
    const result = await createControlMeasureAction(
      PGR_IDS.riskA,
      createInput({ controlLevel: "administrative", applicable: true }),
    );
    expect(!result.ok && result.error.code).toBe("VALIDATION");
  });

  it("lista de org_a não vaza medida de org_b", async () => {
    const result = await listControlMeasuresAction(PGR_IDS.riskA, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rows.every((r) => r.id !== PGR_IDS.controlMeasureB)).toBe(true);
    }
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockReset();
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await listControlMeasuresAction(PGR_IDS.riskA, {});
    expect(!result.ok && result.error.code).toBe("FORBIDDEN");
  });
});
