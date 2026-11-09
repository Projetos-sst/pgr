import "server-only";

import {
  SIGNED_CURRENT_AMBIGUOUS_MESSAGE,
  SIGNED_CURRENT_EXISTS_MESSAGE,
} from "@/shared/domains/medicine/aso-signed";
import { DuplicateError } from "@/shared/errors/duplicate-error";

const MAX_CAUSE_DEPTH = 5;

/**
 * Recusa do gatilho de vigência única (migration 0082) → `DUPLICATE` (409) com mensagem para
 * pessoas. O gatilho levanta SQLSTATE 23505 com a constraint lógica e DETAIL `ambiguous` (legado com
 * mais de uma vigente) ou `current_exists` (já há vigente e o novo não a substitui).
 */
export function signedCurrentConflict(
  error: unknown,
  constraint: "aso_signed_current_unique" | "pcmso_signed_current_unique",
): DuplicateError | null {
  let current: unknown = error;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH && current; depth += 1) {
    if (typeof current !== "object") return null;
    const pg = current as {
      code?: string;
      constraint_name?: string;
      detail?: string;
      cause?: unknown;
    };
    if (pg.code === "23505" && pg.constraint_name === constraint)
      return new DuplicateError(
        pg.detail === "ambiguous"
          ? SIGNED_CURRENT_AMBIGUOUS_MESSAGE
          : SIGNED_CURRENT_EXISTS_MESSAGE,
      );
    current = pg.cause;
  }
  return null;
}
