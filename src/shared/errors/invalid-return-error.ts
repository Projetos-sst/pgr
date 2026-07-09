import "server-only";

import { AppError } from "./app-error";

/**
 * Devolução inválida por regra de negócio: entrega ainda não assinada (não deu baixa, não
 * há o que devolver) ou data de devolução anterior à data de entrega. Mapeado para o
 * código de contrato `VALIDATION` (→ 422) por `toActionError`.
 */
export class InvalidReturnError extends AppError {
  readonly code = "VALIDATION" as const;
  readonly status = 422;

  constructor(message: string) {
    super(message);
  }
}
