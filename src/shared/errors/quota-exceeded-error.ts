import "server-only";

import { AppError } from "./app-error";

export class QuotaExceededError extends AppError {
  readonly code = "QUOTA_EXCEEDED" as const;
  readonly status = 402;

  constructor(message = "QUOTA_EXCEEDED") {
    super(message);
  }
}
