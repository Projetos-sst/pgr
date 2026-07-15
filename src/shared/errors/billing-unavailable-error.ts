import "server-only";

import { AppError } from "./app-error";

/**
 * Billing indisponível — provedor de pagamento (Stripe) não configurado neste
 * ambiente. 503: infraestrutura ausente, não erro do cliente. Não vaza detalhe.
 */
export class BillingUnavailableError extends AppError {
  readonly code = "BILLING_UNAVAILABLE" as const;
  readonly status = 503;

  constructor(message = "BILLING_UNAVAILABLE") {
    super(message);
  }
}
