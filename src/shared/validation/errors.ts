import "server-only";

import { AppError } from "@/shared/errors/app-error";

export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR" as const;
  readonly status = 400;

  constructor(message = "VALIDATION_ERROR") {
    super(message);
  }
}
