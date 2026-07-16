import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import {
  createSignatureRequest,
  getSignatureStatus,
} from "@/shared/server/actions/signatures";
import { submitPublicSignature } from "@/shared/server/actions/public-signatures";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedSignatureOrgs, seedRequest } from "../_helpers/signatures-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const PNG = `data:image/png;base64,${"A".repeat(120)}`;
const tokenFromUrl = (u: string) =>
  u.slice(u.indexOf("/signature-requests/") + "/signature-requests/".length);

(shouldRun ? describe : describe.skip)("US2 — getSignatureStatus", () => {
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

  it("transiciona pending → signed após captura", async () => {
    const created = await createSignatureRequest({
      targetType: "demo",
      payload: { title: "T" },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const before = await getSignatureStatus(created.data.requestId);
    expect(before.ok && before.data.status).toBe("pending");

    await submitPublicSignature(tokenFromUrl(created.data.publicUrl), {
      signerName: "F",
      imageDataUrl: PNG,
    });

    const after = await getSignatureStatus(created.data.requestId);
    expect(after.ok && after.data.status).toBe("signed");
    if (after.ok) expect(after.data.signedAt).toBeDefined();
  });

  it("pedido pending vencido → status derivado expired", async () => {
    const id = await seedRequest(admin, {
      orgId: "org_a",
      rawToken: "tok-x",
      expiresAt: new Date(Date.now() - 60_000),
    });
    const result = await getSignatureStatus(id);
    expect(result.ok && result.data.status).toBe("expired");
  });

  it("id inexistente → NOT_FOUND", async () => {
    const result = await getSignatureStatus("00000000-0000-0000-0000-000000000000");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });
});
