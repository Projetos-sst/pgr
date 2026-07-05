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
import { submitPublicSignature } from "@/shared/server/actions/public-signatures";
import { FREE_SIGNATURE_MONTHLY_QUOTA } from "@/shared/tenant/plan";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedSignatureOrgs, seedRequest } from "../_helpers/signatures-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const PNG = `data:image/png;base64,${"A".repeat(120)}`;
const asPlan = (tenantId: string, plan: "free" | "pro") =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan, role: "owner" });
const createDemo = () =>
  createSignatureRequest({ targetType: "demo", payload: { title: "T" } });

(shouldRun ? describe : describe.skip)("US5 — gate de plano (quota)", () => {
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
  });

  it("free é bloqueado ao exceder a quota mensal (QUOTA_EXCEEDED)", async () => {
    asPlan("org_a", "free");
    for (let i = 0; i < FREE_SIGNATURE_MONTHLY_QUOTA; i += 1) {
      expect((await createDemo()).ok).toBe(true);
    }
    const overflow = await createDemo();
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) expect(overflow.error.code).toBe("QUOTA_EXCEEDED");
  });

  it("pro nunca é bloqueado", async () => {
    asPlan("org_b", "pro");
    for (let i = 0; i < FREE_SIGNATURE_MONTHLY_QUOTA + 3; i += 1) {
      expect((await createDemo()).ok).toBe(true);
    }
  });

  it("a rota pública não checa plano (free no limite ainda assina)", async () => {
    // Preenche a quota do free por inserção direta (admin), depois assina via token.
    for (let i = 0; i < FREE_SIGNATURE_MONTHLY_QUOTA; i += 1) {
      await seedRequest(admin, { orgId: "org_a", rawToken: `seed-${i}` });
    }
    await seedRequest(admin, { orgId: "org_a", rawToken: "tok-public" });

    const submit = await submitPublicSignature("tok-public", {
      signerName: "F",
      imageDataUrl: PNG,
    });
    expect(submit.ok).toBe(true);
  });
});
