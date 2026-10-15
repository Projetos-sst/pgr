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
  listEmployeesAction,
  getEmployeeAction,
  createEmployeeAction,
  deleteEmployeeAction,
  listGesFunctionsAction,
} from "@/shared/server/actions/pgr/employees";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

(shouldRun ? describe : describe.skip)("Server Actions — employees (US5)", () => {
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

  it("lista expõe jobRoleTitle (join) e serviceOrderCount (derivado)", async () => {
    const list = await listEmployeesAction({});
    expect(list.ok).toBe(true);
    if (list.ok) {
      const func = list.data.rows.find((r) => r.id === PGR_IDS.employeeA);
      expect(func?.jobRoleTitle).toBe("Pedreiro"); // seed: employeeA → jobRoleA "Pedreiro"
      expect(typeof func?.serviceOrderCount).toBe("number");
      expect(func?.serviceOrderCount).toBe(0); // sem OS no seed
    }
  });

  it("create sem GES/função é permitido", async () => {
    const result = await createEmployeeAction({
      companyId: PGR_IDS.companyA,
      fullName: "Novo Func",
      cpf: "11122233344",
    });
    expect(result.ok).toBe(true);
  });

  it("CPF duplicado no mesmo tenant → DUPLICATE", async () => {
    const result = await createEmployeeAction({
      companyId: PGR_IDS.companyA,
      fullName: "Clone",
      cpf: "12345678901",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DUPLICATE");
  });

  it("CPF inválido → VALIDATION", async () => {
    const result = await createEmployeeAction({
      companyId: PGR_IDS.companyA,
      fullName: "X",
      cpf: "123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });

  it("picker de função do GES retorna só funções vinculadas àquele GES", async () => {
    const result = await listGesFunctionsAction(PGR_IDS.gesA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].jobRoleId).toBe(PGR_IDS.jobRoleA);
    }
  });

  it("list filtra por status dentro do tenant", async () => {
    const result = await listEmployeesAction({ status: "active" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(1);
      expect(result.data.rows[0].fullName).toBe("Func A");
    }
  });

  it("get/delete de outro tenant → NOT_FOUND", async () => {
    expect((await getEmployeeAction(PGR_IDS.employeeB)).ok).toBe(false);
    const del = await deleteEmployeeAction(PGR_IDS.employeeB);
    expect(del.ok).toBe(false);
    if (!del.ok) expect(del.error.code).toBe("NOT_FOUND");
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await listEmployeesAction({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});
