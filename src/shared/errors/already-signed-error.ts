import "server-only";

import { AppError } from "./app-error";

/**
 * Tentativa de assinar uma entrega que já saiu de `pending`. Mapeado para o código
 * de contrato `ALREADY_SIGNED` (→ 409) por `toActionError`/`HTTP_BY_CODE`.
 */
export class AlreadySignedError extends AppError {
  readonly code = "ALREADY_SIGNED" as const;
  readonly status = 409;

  constructor(message = "Entrega já assinada.") {
    super(message);
  }
}
