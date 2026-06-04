import "server-only";

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED" as const;

  constructor(message = "UNAUTHORIZED") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class NoActiveOrgError extends Error {
  readonly code = "NO_ACTIVE_ORG" as const;

  constructor(message = "NO_ACTIVE_ORG") {
    super(message);
    this.name = "NoActiveOrgError";
  }
}
