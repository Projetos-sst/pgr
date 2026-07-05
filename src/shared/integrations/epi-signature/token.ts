import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { TokenExpiredError, TokenInvalidError } from "@/shared/errors/token-error";

/**
 * Token stateless de assinatura pública (R2): `base64url(payload) + "." +
 * base64url(HMAC_SHA256(payload, EPI_SIGN_TOKEN_SECRET))`. O payload embute
 * `orgId` (tenant resolvido pela rota pública — R1), `deliveryId`, o `method`
 * escolhido pelo técnico (a rota nunca confia no método vindo do cliente) e o
 * `iat` para o TTL de 72h validado na aplicação — zero migration.
 */
export const SIGN_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

export type SignTokenMethod = "qr" | "link";

export const signTokenMethodSchema = z.enum(["qr", "link"]);

// Mesma regex frouxa de `domains/pgr/form-fields.ts` — `z.uuid()` (RFC 4122
// estrito) rejeitaria ids válidos no banco (uuid aceita qualquer hex).
const UUID_FORMAT =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const payloadSchema = z.object({
  orgId: z.string().min(1),
  deliveryId: z.string().regex(UUID_FORMAT),
  method: signTokenMethodSchema,
  iat: z.number().int().positive(),
});

export type SignTokenPayload = z.output<typeof payloadSchema>;

function secret(): string {
  const value = process.env.EPI_SIGN_TOKEN_SECRET;
  if (!value) throw new Error("EPI_SIGN_TOKEN_SECRET is not set.");
  return value;
}

function hmacOf(encodedPayload: string): Buffer {
  return createHmac("sha256", secret()).update(encodedPayload).digest();
}

export function signToken(input: {
  orgId: string;
  deliveryId: string;
  method: SignTokenMethod;
  iat?: number;
}): string {
  const payload: SignTokenPayload = {
    orgId: input.orgId,
    deliveryId: input.deliveryId,
    method: input.method,
    iat: input.iat ?? Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${hmacOf(encoded).toString("base64url")}`;
}

/**
 * Verifica HMAC (comparação em tempo constante) ANTES de olhar o conteúdo —
 * malformado, adulterado e inexistente têm o mesmo desfecho `TOKEN_INVALID`
 * (anti-enumeração); só um token autêntico pode chegar em `TOKEN_EXPIRED`.
 */
export function verifyToken(token: string, now = Date.now()): SignTokenPayload {
  const [encoded, signature, ...rest] = token.split(".");
  if (!encoded || !signature || rest.length > 0) throw new TokenInvalidError();

  const given = Buffer.from(signature, "base64url");
  const expected = hmacOf(encoded);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new TokenInvalidError();
  }

  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new TokenInvalidError();
  }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) throw new TokenInvalidError();

  if (now - parsed.data.iat > SIGN_TOKEN_TTL_MS) throw new TokenExpiredError();
  return parsed.data;
}
