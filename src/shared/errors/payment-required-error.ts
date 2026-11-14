import "server-only";

import { AppError } from "./app-error";

export const PAYMENT_REQUIRED_MESSAGE =
  "O pagamento deste serviço avulso ainda não foi confirmado.";

export class PaymentRequiredError extends AppError {
  readonly status = 402;

  get code(): "PAYMENT_REQUIRED" {
    return "PAYMENT_REQUIRED";
  }

  constructor(message = PAYMENT_REQUIRED_MESSAGE) {
    super(message);
  }
}
