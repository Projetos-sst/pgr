import { createHash, randomBytes } from "node:crypto";

/** TTL default do token (72 h). Configurável por pedido via `ttlSeconds`. */
export const DEFAULT_SIGNATURE_TTL_SECONDS = 72 * 60 * 60;

const TOKEN_BYTES = 32; // 256 bits

/** Token cru de alta entropia (256 bits, base64url). Só vive na URL/QR. */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Hash determinístico (sha-256, hex) — é o que persiste em `token_hash`. */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Instante de expiração a partir de um TTL em segundos. */
export function computeExpiresAt(
  ttlSeconds: number = DEFAULT_SIGNATURE_TTL_SECONDS,
  from: Date = new Date(),
): Date {
  return new Date(from.getTime() + ttlSeconds * 1000);
}

/**
 * "Expirado" é derivado, não persistido: um pedido `pending` cujo `expires_at`
 * já passou. Pedidos `signed`/`cancelled` nunca contam como expirados.
 */
export function isExpired(
  expiresAt: Date,
  status: string,
  now: Date = new Date(),
): boolean {
  return status === "pending" && expiresAt.getTime() < now.getTime();
}
