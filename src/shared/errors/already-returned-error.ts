import "server-only";

import { AppError } from "./app-error";

/**
 * Tentativa de devolver um item de entrega que já tem `returned_at`. Mapeado para o
 * código de contrato `ALREADY_RETURNED` (→ 409) por `toActionError`/`HTTP_BY_CODE`.
 */
export class AlreadyReturnedError extends AppError {
  readonly code = "ALREADY_RETURNED" as const;
  readonly status = 409;

  constructor(message = "Item já devolvido.") {
    super(message);
  }
}
