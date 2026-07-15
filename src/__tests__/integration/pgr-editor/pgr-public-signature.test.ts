/**
 * Fluxo público de assinatura do PGR (target_type='pgr') via token — sem sessão Clerk.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import {
  resolvePublicSignature,
  submitPublicSignature,
} from "@/shared/server/actions/public-signatures";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedSignatureOrgs, seedRequest } from "../_helpers/signatures-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const PNG = `data:image/png;base64,${"A".repeat(120)}`;
const PGR_PAYLOAD = {
  documentTitle: "PGR — A Ltda",
  companyName: "A Ltda",
  workUnitName: null,
  responsibleName: null,
  issuedAt: null,
  validUntil: null,
  revisionNumber: 1,
};

(shouldRun ? describe : describe.skip)("Assinatura do PGR — fluxo público", () => {
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

  it("token válido → signable com o payload mínimo do PGR", async () => {
    await seedRequest(admin, {
      orgId: "org_a",
      rawToken: "pgr-tok",
      targetType: "pgr",
      payload: PGR_PAYLOAD,
    });
    const view = await resolvePublicSignature("pgr-tok");
    expect(view.state).toBe("signable");
    expect(view.targetType).toBe("pgr");
    expect((view.payload as { documentTitle: string }).documentTitle).toBe(
      "PGR — A Ltda",
    );
  });

  it("token inválido ≡ inexistente → invalid (anti-enumeração)", async () => {
    expect((await resolvePublicSignature("nao-existe")).state).toBe("invalid");
  });

  it("token expirado → expired, sem escrita", async () => {
    await seedRequest(admin, {
      orgId: "org_a",
      rawToken: "pgr-exp",
      targetType: "pgr",
      payload: PGR_PAYLOAD,
      expiresAt: new Date(Date.now() - 3_600_000),
    });
    expect((await resolvePublicSignature("pgr-exp")).state).toBe("expired");
    const submit = await submitPublicSignature("pgr-exp", {
      signerName: "F",
      imageDataUrl: PNG,
    });
    expect(!submit.ok && submit.error.code).toBe("EXPIRED");
  });

  it("replay: 2ª submissão do mesmo token → ALREADY_USED, no máximo 1 captura", async () => {
    await seedRequest(admin, {
      orgId: "org_a",
      rawToken: "pgr-replay",
      targetType: "pgr",
      payload: PGR_PAYLOAD,
    });
    const first = await submitPublicSignature("pgr-replay", {
      signerName: "F",
      imageDataUrl: PNG,
    });
    expect(first.ok).toBe(true);
    const second = await submitPublicSignature("pgr-replay", {
      signerName: "F",
      imageDataUrl: PNG,
    });
    expect(!second.ok && second.error.code).toBe("ALREADY_USED");
    const [{ n }] = await admin<{ n: string }[]>`
      select count(*)::text as n from public.signature_captures where org_id='org_a'`;
    expect(n).toBe("1");
  });
});
