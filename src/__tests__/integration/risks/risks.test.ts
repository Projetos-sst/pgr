/**
 * Integração das Server Actions de Risco do GES contra Postgres efêmero.
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
  listRisksAction,
  getRiskAction,
  createRiskAction,
  updateRiskAction,
  deleteRiskAction,
} from "@/shared/server/actions/pgr/risks";
import type { RiskInput } from "@/shared/domains/pgr/risk";

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

function createInput(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    gesId: PGR_IDS.gesA,
    agentType: "physical",
    description: "Risco de teste",
    ...overrides,
  };
}

(shouldRun ? describe : describe.skip)("Server Actions — risks (US1)", () => {
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

  it("list retorna apenas riscos do tenant ativo, com nome do GES", async () => {
    const result = await listRisksAction({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(1);
      expect(result.data.rows[0].gesId).toBe(PGR_IDS.gesA);
      expect(result.data.rows[0].gesName).toBe("GES A");
    }
  });

  it("getById do risco do tenant retorna o registro", async () => {
    const result = await getRiskAction(PGR_IDS.riskA);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.gesId).toBe(PGR_IDS.gesA);
  });

  it("create válido persiste e aparece na lista", async () => {
    const created = await createRiskAction(createInput({ hazard: "Ruído" }));
    expect(created.ok).toBe(true);
    const list = await listRisksAction({});
    expect(list.ok && list.data.total).toBe(2);
  });

  it("create com unidade quantitativa + concentração é aceito", async () => {
    const created = await createRiskAction(
      createInput({ measurementUnit: "db_a", concentrationIntensity: "87.5" }),
    );
    expect(created.ok).toBe(true);
  });

  it.each(["physical", "chemical", "ergonomic"] as const)(
    "creates and edits %s in the selected exposure context",
    async (agentType) => {
      const input = createInput({
        agentType,
        companyId: PGR_IDS.companyA,
        workUnitId: PGR_IDS.workUnitA,
      });
      const result = await createRiskAction(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const edited = await updateRiskAction(result.data.id, {
        ...input,
        description: "Revisado pelo usuário",
      });
      expect(edited.ok && edited.data.description).toBe("Revisado pelo usuário");
      expect(edited.ok && edited.data.gesId).toBe(PGR_IDS.gesA);
    },
  );

  it("rejects a GES inconsistent with the selected company or work unit without changing the risk", async () => {
    for (const context of [
      { companyId: PGR_IDS.companyB },
      { workUnitId: PGR_IDS.workUnitB },
    ]) {
      const input = createInput(context);
      const created = await createRiskAction(input);
      expect(!created.ok && created.error.code).toBe("FK_NOT_FOUND");
      const updated = await updateRiskAction(PGR_IDS.riskA, input);
      expect(!updated.ok && updated.error.code).toBe("FK_NOT_FOUND");
    }
    const unchanged = await getRiskAction(PGR_IDS.riskA);
    expect(unchanged.ok && unchanged.data.description).not.toBe("Risco de teste");
  });

  it("does not create or edit risks when PGR is disabled, preserving existing records", async () => {
    await admin`update company_modules set enabled = false where company_id = ${PGR_IDS.companyA} and module = 'pgr'`;
    const created = await createRiskAction(createInput());
    expect(!created.ok && created.error.code).toBe("FORBIDDEN");
    const updated = await updateRiskAction(PGR_IDS.riskA, createInput());
    expect(!updated.ok && updated.error.code).toBe("FORBIDDEN");
    const [{ count }] =
      await admin`select count(*)::int as count from risks where org_id = 'org_a'`;
    expect(count).toBe(1);
  });

  it("create qualitative_na + concentração → VALIDATION (concentrationIntensity)", async () => {
    const result = await createRiskAction(
      createInput({ measurementUnit: "qualitative_na", concentrationIntensity: "5" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error.fields?.concentrationIntensity).toBeDefined();
    }
  });

  it("create sem agentType/description → VALIDATION", async () => {
    const { agentType: _a, ...noAgent } = createInput();
    const result = await createRiskAction(noAgent as RiskInput);
    expect(!result.ok && result.error.code).toBe("VALIDATION");
    const result2 = await createRiskAction(createInput({ description: "" }));
    expect(!result2.ok && result2.error.code).toBe("VALIDATION");
  });

  it("update de corpo completo altera o registro do tenant", async () => {
    const result = await updateRiskAction(PGR_IDS.riskA, {
      gesId: PGR_IDS.gesA,
      agentType: "chemical",
      description: "Descrição atualizada",
      exposureTime: "2_4h",
    });
    expect(result.ok).toBe(true);
    const after = await getRiskAction(PGR_IDS.riskA);
    expect(after.ok && after.data.description).toBe("Descrição atualizada");
    expect(after.ok && after.data.agentType).toBe("chemical");
  });

  it("delete remove e getById seguinte → NOT_FOUND", async () => {
    const del = await deleteRiskAction(PGR_IDS.riskA);
    expect(del.ok).toBe(true);
    const after = await getRiskAction(PGR_IDS.riskA);
    expect(!after.ok && after.error.code).toBe("NOT_FOUND");
  });

  it("cross-tenant get/update/delete (risco de org_b) → NOT_FOUND", async () => {
    const get = await getRiskAction(PGR_IDS.riskB);
    expect(!get.ok && get.error.code).toBe("NOT_FOUND");
    const upd = await updateRiskAction(PGR_IDS.riskB, {
      gesId: PGR_IDS.gesA,
      agentType: "physical",
      description: "x",
    });
    expect(!upd.ok && upd.error.code).toBe("NOT_FOUND");
    const del = await deleteRiskAction(PGR_IDS.riskB);
    expect(!del.ok && del.error.code).toBe("NOT_FOUND");
  });

  it("risco de outro tenant nunca aparece na listagem", async () => {
    const result = await listRisksAction({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rows.every((r) => r.gesId !== PGR_IDS.gesB)).toBe(true);
    }
  });

  it("gesId inválido → FK_NOT_FOUND", async () => {
    const result = await createRiskAction(createInput({ gesId: RANDOM_UUID }));
    expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
  });

  it("gesId de outro tenant → FK_NOT_FOUND", async () => {
    const result = await createRiskAction(createInput({ gesId: PGR_IDS.gesB }));
    expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockReset();
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await listRisksAction({});
    expect(!result.ok && result.error.code).toBe("FORBIDDEN");
  });
});
