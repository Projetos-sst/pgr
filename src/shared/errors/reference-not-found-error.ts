import "server-only";

import { AppError } from "./app-error";

export class ReferenceNotFoundError extends AppError {
  readonly code = "FK_NOT_FOUND" as const;
  readonly status = 422;

  constructor(message = "FK_NOT_FOUND") {
    super(message);
  }
}
