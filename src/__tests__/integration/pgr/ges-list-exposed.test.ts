import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { listGesAction, getGesAction } from "@/shared/server/actions/pgr/ges";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

(shouldRun ? describe : describe.skip)("Server Actions — listGes exposedWorkers (US4)", () => {
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

  it("a LISTA agrega exposedWorkers por GES e concorda com o single", async () => {
    // seed: gesA tem um ges_job_role com worker_count = 3
    const list = await listGesAction({});
    expect(list.ok).toBe(true);
    const listExposed =
      list.ok ? list.data.rows.find((row) => row.id === PGR_IDS.gesA)?.exposedWorkers : null;
    expect(listExposed).toBe(3);

    const single = await getGesAction(PGR_IDS.gesA);
    const singleExposed = single.ok ? single.data.exposedWorkers : null;
    expect(singleExposed).toBe(listExposed);
  });
});
