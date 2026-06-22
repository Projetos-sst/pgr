import "server-only";

import { AppError } from "./app-error";

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND" as const;
  readonly status = 404;

  constructor(message = "NOT_FOUND") {
    super(message);
  }
}
