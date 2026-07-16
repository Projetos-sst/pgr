import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { createSignatureRequest } from "@/shared/server/actions/signatures";
import { hashToken } from "@/shared/domains/signatures/token";
import { publicSignaturePath } from "@/shared/domains/signatures/public-url";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedSignatureOrgs } from "../_helpers/signatures-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string, plan: "free" | "pro" = "free") =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan, role: "owner" });

function tokenFromUrl(publicUrl: string): string {
  return publicUrl.slice(
    publicUrl.indexOf("/signature-requests/") + "/signature-requests/".length,
  );
}

(shouldRun ? describe : describe.skip)("US1 — createSignatureRequest", () => {
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
    asOwner("org_a");
  });

  it("persiste escopado ao org e retorna publicUrl + qrCodeDataUrl", async () => {
    const result = await createSignatureRequest({
      targetType: "demo",
      payload: { title: "Termo" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.data.publicUrl).toContain(publicSignaturePath(""));

    const rows = await admin<
      { org_id: string; token_hash: string; status: string }[]
    >`select org_id, token_hash, status from public.signature_requests where id = ${result.data.requestId}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].org_id).toBe("org_a");
    expect(rows[0].status).toBe("pending");
  });

  it("grava o token_hash (sha-256), nunca o token cru", async () => {
    const result = await createSignatureRequest({
      targetType: "demo",
      payload: { title: "Termo" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const rawToken = tokenFromUrl(result.data.publicUrl);
    const [row] = await admin<{ token_hash: string }[]>`
      select token_hash from public.signature_requests where id = ${result.data.requestId}`;
    expect(row.token_hash).toBe(hashToken(rawToken));
    expect(row.token_hash).not.toBe(rawToken);
  });

  it("payload inválido para o target_type → VALIDATION", async () => {
    const result = await createSignatureRequest({
      targetType: "demo",
      payload: { description: "sem título" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });
});
