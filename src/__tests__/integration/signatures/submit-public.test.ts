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
import { seedSignatureOrgs } from "../_helpers/signatures-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const PNG = `data:image/png;base64,${"A".repeat(120)}`;
const tokenFromUrl = (u: string) => u.slice(u.indexOf("/assinar/") + "/assinar/".length);

(shouldRun ? describe : describe.skip)("US1 — submitPublicSignature", () => {
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

  it("grava captura via token e transiciona pending → signed", async () => {
    const created = await createSignatureRequest({
      targetType: "demo",
      payload: { title: "T" },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const token = tokenFromUrl(created.data.publicUrl);

    const submit = await submitPublicSignature(token, {
      signerName: "Fulano",
      imageDataUrl: PNG,
    });
    expect(submit.ok).toBe(true);

    const captures = await admin<
      { method: string; signer_name: string; org_id: string }[]
    >`
      select method, signer_name, org_id from public.signature_captures
      where request_id = ${created.data.requestId}`;
    expect(captures).toHaveLength(1);
    expect(captures[0].method).toBe("link");
    expect(captures[0].org_id).toBe("org_a");

    const status = await getSignatureStatus(created.data.requestId);
    expect(status.ok && status.data.status).toBe("signed");
  });
});
