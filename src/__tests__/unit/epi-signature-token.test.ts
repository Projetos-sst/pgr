import {
  SIGN_TOKEN_TTL_MS,
  signToken,
  verifyToken,
} from "@/shared/integrations/epi-signature/token";
import { TokenExpiredError, TokenInvalidError } from "@/shared/errors/token-error";

const BASE = {
  orgId: "org_a",
  deliveryId: "11111111-1111-1111-1111-1111111111a9",
} as const;

describe("epi-signature token (HMAC stateless, TTL 72h)", () => {
  const ORIGINAL_SECRET = process.env.EPI_SIGN_TOKEN_SECRET;

  beforeEach(() => {
    process.env.EPI_SIGN_TOKEN_SECRET = "test-secret";
  });
  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.EPI_SIGN_TOKEN_SECRET;
    else process.env.EPI_SIGN_TOKEN_SECRET = ORIGINAL_SECRET;
  });

  it("round-trip sign/verify preserva orgId, deliveryId e method", () => {
    const token = signToken({ ...BASE, method: "qr" });
    const payload = verifyToken(token);

    expect(payload.orgId).toBe("org_a");
    expect(payload.deliveryId).toBe(BASE.deliveryId);
    expect(payload.method).toBe("qr");
  });

  it("method link viaja assinado no payload", () => {
    expect(verifyToken(signToken({ ...BASE, method: "link" })).method).toBe("link");
  });

  it("payload adulterado (trocar orgId/method) quebra o HMAC → TOKEN_INVALID", () => {
    const token = signToken({ ...BASE, method: "link" });
    const [encoded, signature] = token.split(".");
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    const tampered =
      Buffer.from(JSON.stringify({ ...payload, orgId: "org_b" })).toString("base64url") +
      "." +
      signature;

    expect(() => verifyToken(tampered)).toThrow(TokenInvalidError);
  });

  it.each(["", "abc", "a.b.c", "somente-um-segmento"])(
    "token malformado (%p) → TOKEN_INVALID (resposta uniforme)",
    (token) => {
      expect(() => verifyToken(token)).toThrow(TokenInvalidError);
    },
  );

  it("assinado com outro segredo → TOKEN_INVALID", () => {
    const token = signToken({ ...BASE, method: "qr" });
    process.env.EPI_SIGN_TOKEN_SECRET = "outro-segredo";
    expect(() => verifyToken(token)).toThrow(TokenInvalidError);
  });

  it("iat além de 72h → TOKEN_EXPIRED; dentro do limite → válido", () => {
    const now = Date.now();
    const expired = signToken({
      ...BASE,
      method: "qr",
      iat: now - SIGN_TOKEN_TTL_MS - 1,
    });
    expect(() => verifyToken(expired, now)).toThrow(TokenExpiredError);

    const atLimit = signToken({ ...BASE, method: "qr", iat: now - SIGN_TOKEN_TTL_MS });
    expect(verifyToken(atLimit, now).deliveryId).toBe(BASE.deliveryId);
  });
});
