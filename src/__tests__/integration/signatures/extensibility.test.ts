import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import * as repo from "@/shared/db/repositories/signature-requests";
import { computeExpiresAt } from "@/shared/domains/signatures/token";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedSignatureOrgs } from "../_helpers/signatures-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

/**
 * US3/SC-004 — reuso por múltiplos módulos sem mudança de schema: um `target_type`
 * arbitrário (ex.: 'work_order') usa as MESMAS tabelas/colunas. `target_type` é
 * `text` no banco → adicionar um consumidor é só registry (código), zero migração.
 */
(shouldRun ? describe : describe.skip)("US3 — extensibilidade do contrato", () => {
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

  it("um novo target_type cria e assina pelas mesmas tabelas", async () => {
    const { id } = await repo.createRequest("org_a", {
      targetType: "work_order",
      tokenHash: "hash-work-order",
      payload: { ref: "OS-42" },
      expiresAt: computeExpiresAt(3600),
    });

    const captured = await repo.consumeAndCapture("org_a", {
      requestId: id,
      imageData: `data:image/png;base64,${"A".repeat(60)}`,
      signerName: "Fulano",
      method: "link",
    });
    expect(captured).toBe(true);

    const [row] = await admin<{ target_type: string; status: string }[]>`
      select target_type, status from public.signature_requests where id = ${id}`;
    expect(row.target_type).toBe("work_order");
    expect(row.status).toBe("signed");
  });
});
