import "server-only";

import { AppError } from "@/shared/errors/app-error";

export class UnauthorizedError extends AppError {
  readonly code = "UNAUTHORIZED" as const;
  readonly status = 401;

  constructor(message = "UNAUTHORIZED") {
    super(message);
  }
}

export class NoActiveOrgError extends AppError {
  readonly code = "NO_ACTIVE_ORG" as const;
  readonly status = 403;

  constructor(message = "NO_ACTIVE_ORG") {
    super(message);
  }
}

export class OrgQuotaExceededError extends AppError {
  readonly code = "ORG_QUOTA_EXCEEDED" as const;
  readonly status = 403;

  constructor(message = "ORG_QUOTA_EXCEEDED") {
    super(message);
  }
}
