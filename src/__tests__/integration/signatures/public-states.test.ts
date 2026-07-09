import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import {
  submitPublicSignature,
  resolvePublicSignature,
} from "@/shared/server/actions/public-signatures";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedSignatureOrgs, seedRequest } from "../_helpers/signatures-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const PNG = `data:image/png;base64,${"A".repeat(120)}`;

(shouldRun ? describe : describe.skip)("US1 — estados públicos do token", () => {
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
  });

  it("token inexistente → NOT_FOUND / invalid, sem gravação", async () => {
    const submit = await submitPublicSignature("nao-existe", {
      signerName: "F",
      imageDataUrl: PNG,
    });
    expect(submit.ok).toBe(false);
    if (!submit.ok) expect(submit.error.code).toBe("NOT_FOUND");
    expect((await resolvePublicSignature("nao-existe")).state).toBe("invalid");
  });

  it("token expirado → EXPIRED / expired, sem gravação", async () => {
    const raw = "tok-expired";
    await seedRequest(admin, {
      orgId: "org_a",
      rawToken: raw,
      expiresAt: new Date(Date.now() - 60_000),
    });
    const submit = await submitPublicSignature(raw, {
      signerName: "F",
      imageDataUrl: PNG,
    });
    expect(submit.ok).toBe(false);
    if (!submit.ok) expect(submit.error.code).toBe("EXPIRED");
    expect((await resolvePublicSignature(raw)).state).toBe("expired");

    const caps = await admin`select 1 from public.signature_captures`;
    expect(caps).toHaveLength(0);
  });

  it("token já utilizado → ALREADY_USED / used, sem nova gravação", async () => {
    const raw = "tok-used";
    await seedRequest(admin, {
      orgId: "org_a",
      rawToken: raw,
      status: "signed",
      usedAt: new Date(),
    });
    const submit = await submitPublicSignature(raw, {
      signerName: "F",
      imageDataUrl: PNG,
    });
    expect(submit.ok).toBe(false);
    if (!submit.ok) expect(submit.error.code).toBe("ALREADY_USED");
    expect((await resolvePublicSignature(raw)).state).toBe("used");
  });
});
