import "server-only";

export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR" as const;

  constructor(message = "VALIDATION_ERROR") {
    super(message);
    this.name = "ValidationError";
  }
}
