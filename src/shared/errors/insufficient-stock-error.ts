import "server-only";

import { AppError } from "./app-error";

/**
 * Saída de estoque maior que o saldo disponível. Mapeado para o código de contrato
 * `INSUFFICIENT_STOCK` (→ 422) automaticamente por `toActionError` (qualquer `AppError`
 * vira `{ code, message }`); o `HTTP_BY_CODE` em `shared/api/rest.ts` traduz para 422.
 */
export class InsufficientStockError extends AppError {
  readonly code = "INSUFFICIENT_STOCK" as const;
  readonly status = 422;

  constructor(available: number, requested: number) {
    super(`Saldo insuficiente: disponível ${available}, solicitado ${requested}`);
  }
}
