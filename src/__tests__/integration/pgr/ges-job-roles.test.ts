import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { updateGesJobRoleAction } from "@/shared/server/actions/pgr/ges";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

async function readLink(admin: ReturnType<typeof postgres>) {
  const [row] = await admin`
    select worker_count, work_schedule from public.ges_job_roles
    where id = ${PGR_IDS.gesJobRoleA}`;
  return row as { worker_count: number; work_schedule: string | null };
}

(shouldRun ? describe : describe.skip)("Server Actions — ges_job_roles update (US4)", () => {
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

  it("update parcial (só workerCount) PRESERVA o workSchedule existente", async () => {
    const withSchedule = await updateGesJobRoleAction(PGR_IDS.gesJobRoleA, PGR_IDS.gesA, {
      workerCount: 3,
      workSchedule: "44h",
    });
    expect(withSchedule.ok).toBe(true);
    expect((await readLink(admin)).work_schedule).toBe("44h");

    const partial = await updateGesJobRoleAction(PGR_IDS.gesJobRoleA, PGR_IDS.gesA, {
      workerCount: 9,
    });
    expect(partial.ok).toBe(true);

    const row = await readLink(admin);
    expect(row.worker_count).toBe(9);
    expect(row.work_schedule).toBe("44h");
  });

  it("update com workSchedule novo sobrescreve", async () => {
    await updateGesJobRoleAction(PGR_IDS.gesJobRoleA, PGR_IDS.gesA, {
      workerCount: 3,
      workSchedule: "44h",
    });
    await updateGesJobRoleAction(PGR_IDS.gesJobRoleA, PGR_IDS.gesA, {
      workerCount: 3,
      workSchedule: "40h",
    });
    expect((await readLink(admin)).work_schedule).toBe("40h");
  });
});
