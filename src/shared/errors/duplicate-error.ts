import "server-only";

import { AppError } from "./app-error";

/**
 * Conflito de unicidade detectado fora do banco (ex.: objeto já existente no Storage). Usa o
 * mesmo código de contrato `DUPLICATE` (→ 409) que a violação SQLSTATE 23505, para o cliente
 * tratar os dois casos da mesma forma. `field` (opcional) leva a mensagem ao campo do formulário.
 */
export class DuplicateError extends AppError {
  readonly code = "DUPLICATE" as const;
  readonly status = 409;

  constructor(
    message = "Registro já existe neste escritório.",
    options: { field?: string } = {},
  ) {
    super(message, options.field ? { [options.field]: message } : undefined);
  }
}
