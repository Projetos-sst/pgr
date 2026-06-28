import "server-only";

import { AppError } from "./app-error";

/**
 * Entrega já assinada / token já utilizado. A transição de `signature_status` é única e
 * idempotente: uma segunda confirmação (manual ou pela rota pública) é recusada. Mapeado
 * para o código de contrato `ALREADY_SIGNED` (→ 409) por `toActionError` (qualquer
 * `AppError` vira `{ code, message }`); o `HTTP_BY_CODE` em `shared/api/rest.ts` traduz para 409.
 */
export class AlreadySignedError extends AppError {
  readonly code = "ALREADY_SIGNED" as const;
  readonly status = 409;

  constructor(message = "Esta entrega já foi assinada.") {
    super(message);
  }
}
