/**
 * Integração das Server Actions do Documento PGR contra Postgres efêmero.
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
  listPgrAction,
  getPgrAction,
  createPgrAction,
  updatePgrAction,
  deletePgrAction,
} from "@/shared/server/actions/pgr/pgr";
import type { PgrCreateInput } from "@/shared/domains/pgr/pgr";

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

function createInput(overrides: Partial<PgrCreateInput> = {}): PgrCreateInput {
  return {
    companyId: PGR_IDS.companyA,
    registrationType: "not_applicable",
    issuedAt: "2026-01-10",
    validUntil: "2027-01-10",
    declarationAccepted: true,
    ...overrides,
  };
}

(shouldRun ? describe : describe.skip)("Server Actions — pgr (US1/US2)", () => {
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

  it("list retorna apenas PGRs do tenant ativo, com nome da empresa", async () => {
    const result = await listPgrAction({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(1);
      expect(result.data.rows[0].companyId).toBe(PGR_IDS.companyA);
      expect(result.data.rows[0].companyName).toBe("A Ltda");
    }
  });

  it("getById do PGR do tenant retorna o registro", async () => {
    const result = await getPgrAction(PGR_IDS.pgrA);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.companyId).toBe(PGR_IDS.companyA);
  });

  it("create com aceite persiste e aparece na lista", async () => {
    const created = await createPgrAction(
      createInput({ workUnitId: PGR_IDS.workUnitA, responsible: "Eng. A" }),
    );
    expect(created.ok).toBe(true);
    const list = await listPgrAction({});
    expect(list.ok && list.data.total).toBe(2);
  });

  it("create sem aceite → VALIDATION", async () => {
    const { declarationAccepted: _omit, ...withoutAccept } = createInput();
    const result = await createPgrAction(withoutAccept as PgrCreateInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error.fields?.declarationAccepted).toBeDefined();
    }
  });

  it("create com validade < emissão → VALIDATION", async () => {
    const result = await createPgrAction(
      createInput({ issuedAt: "2026-06-01", validUntil: "2026-01-01" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });

  it("update de corpo completo altera o registro do tenant", async () => {
    const result = await updatePgrAction(PGR_IDS.pgrA, {
      companyId: PGR_IDS.companyA,
      workUnitId: PGR_IDS.workUnitA,
      responsible: "Eng. Atualizado",
      registrationType: "crea",
      registrationNumber: "SP-999",
      issuedAt: "2026-02-01",
      validUntil: "2027-02-01",
    });
    expect(result.ok).toBe(true);
    const after = await getPgrAction(PGR_IDS.pgrA);
    expect(after.ok && after.data.responsible).toBe("Eng. Atualizado");
  });

  it("delete remove e getById seguinte → NOT_FOUND", async () => {
    const del = await deletePgrAction(PGR_IDS.pgrA);
    expect(del.ok).toBe(true);
    const after = await getPgrAction(PGR_IDS.pgrA);
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.error.code).toBe("NOT_FOUND");
  });

  it("cross-tenant get/update/delete (PGR de org_b) → NOT_FOUND", async () => {
    const get = await getPgrAction(PGR_IDS.pgrB);
    expect(!get.ok && get.error.code).toBe("NOT_FOUND");
    const upd = await updatePgrAction(PGR_IDS.pgrB, {
      companyId: PGR_IDS.companyA,
      registrationType: "not_applicable",
      issuedAt: "2026-01-10",
      validUntil: "2027-01-10",
    });
    expect(!upd.ok && upd.error.code).toBe("NOT_FOUND");
    const del = await deletePgrAction(PGR_IDS.pgrB);
    expect(!del.ok && del.error.code).toBe("NOT_FOUND");
  });

  it("PGR de outro tenant nunca aparece na listagem", async () => {
    const result = await listPgrAction({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rows.every((r) => r.companyId !== PGR_IDS.companyB)).toBe(true);
    }
  });

  it("empresa inválida → FK_NOT_FOUND", async () => {
    const result = await createPgrAction(createInput({ companyId: RANDOM_UUID }));
    expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
  });

  it("obra inválida → FK_NOT_FOUND", async () => {
    const result = await createPgrAction(createInput({ workUnitId: RANDOM_UUID }));
    expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
  });

  it("obra de outra empresa → FK_NOT_FOUND", async () => {
    const result = await createPgrAction(
      createInput({ companyId: PGR_IDS.companyA, workUnitId: PGR_IDS.workUnitB }),
    );
    expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
  });

  it("empresa de outro tenant → FK_NOT_FOUND", async () => {
    const result = await createPgrAction(createInput({ companyId: PGR_IDS.companyB }));
    expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockReset();
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await listPgrAction({});
    expect(!result.ok && result.error.code).toBe("FORBIDDEN");
  });
});
