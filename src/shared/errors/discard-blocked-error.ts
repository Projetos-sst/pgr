import "server-only";

import { AppError } from "./app-error";

export class DiscardBlockedError extends AppError {
  readonly code = "DISCARD_BLOCKED" as const;
  readonly status = 409;

  constructor(
    message = "Descarte bloqueado: não há política de guarda aprovada ou o prazo de guarda não terminou.",
  ) {
    super(message);
  }
}
