import "server-only";

import { AppError } from "./app-error";

/**
 * Token de assinatura ausente, malformado ou com HMAC inválido. Resposta uniforme
 * para adulterado vs. inexistente (anti-enumeração) — código `TOKEN_INVALID` (→ 404).
 */
export class TokenInvalidError extends AppError {
  readonly code = "TOKEN_INVALID" as const;
  readonly status = 404;

  constructor(message = "Link de assinatura inválido.") {
    super(message);
  }
}

/** Token com HMAC válido porém além do TTL de 72h — código `TOKEN_EXPIRED` (→ 410). */
export class TokenExpiredError extends AppError {
  readonly code = "TOKEN_EXPIRED" as const;
  readonly status = 410;

  constructor(message = "Link de assinatura expirado.") {
    super(message);
  }
}
