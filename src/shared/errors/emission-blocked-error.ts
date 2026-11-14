import "server-only";

import { EMISSION_BLOCKED_MESSAGE } from "@/shared/domains/commercial/trial";

import { AppError } from "./app-error";

export class EmissionBlockedError extends AppError {
  readonly code = "EMISSION_BLOCKED" as const;
  readonly status = 402;

  constructor(message = EMISSION_BLOCKED_MESSAGE) {
    super(message);
  }
}
