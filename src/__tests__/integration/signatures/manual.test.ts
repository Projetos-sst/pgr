import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { signManually } from "@/shared/server/actions/signatures";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedSignatureOrgs, seedRequest } from "../_helpers/signatures-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;

(shouldRun ? describe : describe.skip)("US4 — signManually", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });
  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedSignatureOrgs(admin);
    mockedGate.mockReset();
    mockedGate.mockResolvedValue({
      userId: "u",
      tenantId: "org_a",
      plan: "free",
      role: "owner",
    });
  });

  it("registra captura manual e transiciona pending → signed", async () => {
    const id = await seedRequest(admin, { orgId: "org_a", rawToken: "tok-m" });
    const result = await signManually(id, { signerName: "Fulano" });
    expect(result.ok).toBe(true);

    const [cap] = await admin<{ method: string }[]>`
      select method from public.signature_captures where request_id = ${id}`;
    expect(cap.method).toBe("manual");

    const [req] = await admin<{ status: string }[]>`
      select status from public.signature_requests where id = ${id}`;
    expect(req.status).toBe("signed");
  });

  it("rejeita pedido já assinado (uso único) → NOT_FOUND", async () => {
    const id = await seedRequest(admin, {
      orgId: "org_a",
      rawToken: "tok-used",
      status: "signed",
      usedAt: new Date(),
    });
    const result = await signManually(id, { signerName: "Outro" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });
});
