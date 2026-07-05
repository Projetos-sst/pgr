import type postgres from "postgres";

// A rota pública valida o HMAC com este segredo; precisa existir ANTES de
// qualquer sign/verify (lido lazy do env a cada chamada).
process.env.EPI_SIGN_TOKEN_SECRET = "integration-test-secret";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Headers({ host: "localhost:3000" })),
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError } from "@/shared/auth/errors";
import {
  generateSignTokenAction,
  getDeliveryByTokenAction,
  submitSignatureAction,
} from "@/shared/server/actions/pgr/epi-deliveries";
import {
  signToken,
  SIGN_TOKEN_TTL_MS,
  type SignTokenMethod,
} from "@/shared/integrations/epi-signature/token";

import { adminClient, applyMigrations } from "./_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "./_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;

/**
 * Gera o token como office staff de org_a e em seguida REJEITA o gate: tudo que
 * a rota pública fizer a partir daqui prova que não depende de sessão/tenant.
 */
async function issueToken(method: SignTokenMethod): Promise<string> {
  mockedGate.mockResolvedValue({
    userId: "u",
    tenantId: "org_a",
    plan: "free",
    role: "owner",
  });
  const res = await generateSignTokenAction(I.epiDeliveryA, method);
  if (!res.ok) throw new Error(`token setup failed: ${res.error.code}`);
  mockedGate.mockRejectedValue(new ForbiddenError());
  return res.data.token;
}

(shouldRun ? describe : describe.skip)("Assinatura pública /sign (012/US3)", () => {
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
  });

  async function readDelivery(id: string) {
    const [row] = await admin<{ signature_status: string; auth_token: string | null }[]>`
      select signature_status, auth_token from public.epi_deliveries where id = ${id}`;
    return row;
  }

  it("assinatura via QR muda o status SEM sessão e limpa o auth_token na mesma transição", async () => {
    const token = await issueToken("qr");

    // leitura pública funciona com o gate rejeitando qualquer sessão
    const read = await getDeliveryByTokenAction(token);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.data.alreadySigned).toBe(false);
      expect(read.data.delivery.employeeName).toBe("Func A");
      expect(read.data.delivery.items).toHaveLength(1);
    }

    const signed = await submitSignatureAction(token);
    expect(signed.ok).toBe(true);
    if (signed.ok) expect(signed.data.signatureStatus).toBe("signed_qr");

    const row = await readDelivery(I.epiDeliveryA);
    expect(row.signature_status).toBe("signed_qr");
    expect(row.auth_token).toBeNull(); // link invalidado na MESMA transição
  });

  it("método `link` embutido no token vira signed_link (o cliente não escolhe)", async () => {
    const token = await issueToken("link");
    const signed = await submitSignatureAction(token);
    expect(signed.ok).toBe(true);
    if (signed.ok) expect(signed.data.signatureStatus).toBe("signed_link");
    expect((await readDelivery(I.epiDeliveryA)).signature_status).toBe("signed_link");
  });

  it("entrega já assinada → ALREADY_SIGNED / alreadySigned (nunca 500)", async () => {
    const token = await issueToken("qr");
    await submitSignatureAction(token);

    // segunda confirmação com o MESMO link
    const again = await submitSignatureAction(token);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe("ALREADY_SIGNED");

    // a página de leitura vira desfecho de negócio, não erro
    const read = await getDeliveryByTokenAction(token);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.data.alreadySigned).toBe(true);
  });

  it("token de outra org não acessa entrega alheia (RLS + payload → TOKEN_INVALID)", async () => {
    await issueToken("qr");
    // token HMAC-válido, mas com tenant org_b no payload: sob withOrg('org_b')
    // a entrega de org_a não existe → resposta uniforme de inválido
    const foreign = signToken({
      orgId: "org_b",
      deliveryId: I.epiDeliveryA,
      method: "qr",
    });

    const read = await getDeliveryByTokenAction(foreign);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe("TOKEN_INVALID");

    const signed = await submitSignatureAction(foreign);
    expect(signed.ok).toBe(false);
    if (!signed.ok) expect(signed.error.code).toBe("TOKEN_INVALID");

    // nada mudou na entrega de org_a
    expect((await readDelivery(I.epiDeliveryA)).signature_status).toBe("pending");
  });

  it("token expirado (> 72h) → TOKEN_EXPIRED", async () => {
    const expired = signToken({
      orgId: "org_a",
      deliveryId: I.epiDeliveryA,
      method: "link",
      iat: Date.now() - SIGN_TOKEN_TTL_MS - 1_000,
    });

    const read = await getDeliveryByTokenAction(expired);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe("TOKEN_EXPIRED");

    const signed = await submitSignatureAction(expired);
    expect(signed.ok).toBe(false);
    if (!signed.ok) expect(signed.error.code).toBe("TOKEN_EXPIRED");
    expect((await readDelivery(I.epiDeliveryA)).signature_status).toBe("pending");
  });

  it("token adulterado ou revogado → TOKEN_INVALID uniforme", async () => {
    const token = await issueToken("qr");

    // assinatura HMAC corrompida
    const tampered = `${token.slice(0, -4)}AAAA`;
    const bad = await submitSignatureAction(tampered);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("TOKEN_INVALID");

    // regenerar substitui o token ativo → o link antigo (ainda HMAC-válido e
    // dentro do TTL) fica revogado
    const newer = await issueToken("qr");
    expect(newer).not.toBe(token);

    const revokedRead = await getDeliveryByTokenAction(token);
    expect(revokedRead.ok).toBe(false);
    if (!revokedRead.ok) expect(revokedRead.error.code).toBe("TOKEN_INVALID");

    const revokedSign = await submitSignatureAction(token);
    expect(revokedSign.ok).toBe(false);
    if (!revokedSign.ok) expect(revokedSign.error.code).toBe("TOKEN_INVALID");

    // o token vigente continua funcionando
    const signed = await submitSignatureAction(newer);
    expect(signed.ok).toBe(true);
  });
});
