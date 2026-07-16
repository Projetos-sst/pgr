import "server-only";

import { AppError } from "./app-error";

/**
 * Violação de regra de negócio de entrada (pré-condição inválida) — mapeada para
 * o código de contrato `VALIDATION` (→ 422) por `toActionError`.
 */
export class ValidationError extends AppError {
  readonly code = "VALIDATION" as const;
  readonly status = 422;

  constructor(message: string) {
    super(message);
  }
}
