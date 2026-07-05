import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { getSignatureStatus } from "@/shared/server/actions/signatures";
import { submitPublicSignature } from "@/shared/server/actions/public-signatures";
import * as repo from "@/shared/db/repositories/signature-requests";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedSignatureOrgs, seedRequest } from "../_helpers/signatures-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const PNG = `data:image/png;base64,${"A".repeat(120)}`;

/**
 * Caminho crítico de isolamento: a policy de capability + withOrg garantem que um
 * token de org_a nunca lê/grava em org_b, e que sem token nada é retornado.
 */
(shouldRun ? describe : describe.skip)("US1 — isolamento multi-tenant", () => {
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

  it("um token só lê a própria linha (org correto); token inexistente → null", async () => {
    await seedRequest(admin, { orgId: "org_a", rawToken: "tok-a" });
    await seedRequest(admin, { orgId: "org_b", rawToken: "tok-b" });

    const a = await repo.getRequestByToken("tok-a");
    const b = await repo.getRequestByToken("tok-b");
    expect(a?.orgId).toBe("org_a");
    expect(b?.orgId).toBe("org_b");
    expect(await repo.getRequestByToken("tok-inexistente")).toBeNull();
  });

  it("assinar com token de org_a grava captura só em org_a", async () => {
    await seedRequest(admin, { orgId: "org_a", rawToken: "tok-a" });
    await seedRequest(admin, { orgId: "org_b", rawToken: "tok-b" });

    const submit = await submitPublicSignature("tok-a", {
      signerName: "F",
      imageDataUrl: PNG,
    });
    expect(submit.ok).toBe(true);

    const byOrg = await admin<{ org_id: string }[]>`
      select org_id from public.signature_captures`;
    expect(byOrg).toHaveLength(1);
    expect(byOrg[0].org_id).toBe("org_a");
  });

  it("leitura interna de status não cruza tenant (org_b não vê pedido de org_a)", async () => {
    const id = await seedRequest(admin, { orgId: "org_a", rawToken: "tok-a" });
    mockedGate.mockResolvedValue({
      userId: "u",
      tenantId: "org_b",
      plan: "pro",
      role: "owner",
    });
    const status = await getSignatureStatus(id);
    expect(status.ok).toBe(false);
    if (!status.ok) expect(status.error.code).toBe("NOT_FOUND");
  });
});
