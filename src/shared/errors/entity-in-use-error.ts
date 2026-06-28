import "server-only";

import { AppError } from "./app-error";

/**
 * Raised when a delete is blocked because the entity still has known dependents
 * (defensive pre-check). Maps to the contract code `IN_USE` (≈409) via
 * `toActionError` (generic `AppError` branch) — the entity is never removed and
 * dependents are never cascaded. See `.specs/010-epi-catalog-crud` (Q2/FR-015/016).
 */
export class EntityInUseError extends AppError {
  readonly code = "IN_USE" as const;
  readonly status = 409;

  constructor(message = "Item em uso e não pode ser excluído.") {
    super(message);
  }
}
