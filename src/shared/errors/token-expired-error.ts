import "server-only";

import { AppError } from "./app-error";

/**
 * Token de assinatura além da janela de 72h, derivada de `epi_deliveries.created_at`
 * (`created_at + 72h < now()` → expirado; zero migration). Recusa a confirmação pela
 * rota pública. Mapeado para o código de contrato `TOKEN_EXPIRED` (→ 410) por
 * `toActionError`; o `HTTP_BY_CODE` em `shared/api/rest.ts` traduz para 410.
 */
export class TokenExpiredError extends AppError {
  readonly code = "TOKEN_EXPIRED" as const;
  readonly status = 410;

  constructor(message = "O link de assinatura expirou.") {
    super(message);
  }
}
