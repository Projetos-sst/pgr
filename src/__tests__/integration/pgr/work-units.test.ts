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
  listWorkUnitsAction,
  getWorkUnitAction,
  createWorkUnitAction,
  updateWorkUnitAction,
  deleteWorkUnitAction,
} from "@/shared/server/actions/pgr/work-units";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

(shouldRun ? describe : describe.skip)("Server Actions — work_units (US2)", () => {
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

  it("create sob empresa do tenant e aparece na lista", async () => {
    const created = await createWorkUnitAction({
      companyId: PGR_IDS.companyA,
      name: "Canteiro Novo",
      description: "Obra",
    });
    expect(created.ok).toBe(true);
    const list = await listWorkUnitsAction({ companyId: PGR_IDS.companyA });
    expect(list.ok && list.data.total).toBe(2);
  });

  it("create com empresa de outro tenant → FK_NOT_FOUND", async () => {
    const result = await createWorkUnitAction({
      companyId: PGR_IDS.companyB,
      name: "X",
      description: "Y",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FK_NOT_FOUND");
  });

  it("campos obrigatórios ausentes → VALIDATION", async () => {
    const result = await createWorkUnitAction({
      companyId: PGR_IDS.companyA,
      name: "",
      description: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });

  it("get/update/delete de outro tenant → NOT_FOUND", async () => {
    expect((await getWorkUnitAction(PGR_IDS.workUnitB)).ok).toBe(false);
    const upd = await updateWorkUnitAction(PGR_IDS.workUnitB, {
      companyId: PGR_IDS.companyA,
      name: "x",
      description: "y",
    });
    expect(upd.ok).toBe(false);
    if (!upd.ok) expect(upd.error.code).toBe("NOT_FOUND");
    const del = await deleteWorkUnitAction(PGR_IDS.workUnitB);
    expect(del.ok).toBe(false);
    if (!del.ok) expect(del.error.code).toBe("NOT_FOUND");
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await listWorkUnitsAction({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});
