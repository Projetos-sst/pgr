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
  listJobRolesAction,
  getJobRoleAction,
  createJobRoleAction,
  deleteJobRoleAction,
} from "@/shared/server/actions/pgr/job-roles";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

(shouldRun ? describe : describe.skip)("Server Actions — job_roles (US3)", () => {
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

  it("título duplicado na mesma empresa → DUPLICATE", async () => {
    const result = await createJobRoleAction({
      companyId: PGR_IDS.companyA,
      title: "Pedreiro",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DUPLICATE");
  });

  it("mesmo título em empresa diferente do tenant é permitido", async () => {
    const created = await createJobRoleAction({
      companyId: PGR_IDS.companyA,
      title: "Eletricista",
    });
    expect(created.ok).toBe(true);
    const list = await listJobRolesAction({ companyId: PGR_IDS.companyA });
    expect(list.ok && list.data.total).toBe(2);
  });

  it("get de outro tenant → NOT_FOUND; delete → NOT_FOUND", async () => {
    expect((await getJobRoleAction(PGR_IDS.jobRoleB)).ok).toBe(false);
    const del = await deleteJobRoleAction(PGR_IDS.jobRoleB);
    expect(del.ok).toBe(false);
    if (!del.ok) expect(del.error.code).toBe("NOT_FOUND");
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await listJobRolesAction({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});
