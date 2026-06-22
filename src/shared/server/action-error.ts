import { ZodError } from "zod";

import { AppError } from "@/shared/errors/app-error";

import type { ActionError } from "./result";

const PG_ERROR_MAP: Record<string, { code: string; message: string }> = {
  "23505": { code: "DUPLICATE", message: "Registro já existe neste escritório." },
  "23503": { code: "FK_NOT_FOUND", message: "Referência inexistente neste escritório." },
  "23514": { code: "VALIDATION", message: "Valor fora do permitido." },
  "23502": { code: "VALIDATION", message: "Campo obrigatório ausente." },
};

const PG_SQLSTATE = /^[0-9A-Z]{5}$/;
const MAX_CAUSE_DEPTH = 5;

/**
 * Walks the `cause` chain because postgres-js errors surfaced through Drizzle are
 * wrapped: the top-level Error carries `message: "Failed query: ..."` and the real
 * SQLSTATE lives on `error.cause.code`. Reading only the top level made every DB
 * constraint violation fall through to an unmapped 500 instead of its 4xx code.
 */
function postgresErrorCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH && current; depth += 1) {
    if (typeof current === "object" && "code" in current) {
      const code = (current as { code: unknown }).code;
      if (typeof code === "string" && PG_SQLSTATE.test(code)) return code;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/**
 * Maps a known error to an ActionError. Returns null for unexpected errors so
 * the caller can rethrow them (never silenced — see action-result contract).
 */
export function toActionError(error: unknown): ActionError | null {
  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.length > 0 ? issue.path.join(".") : "_";
      if (!(key in fields)) fields[key] = issue.message;
    }
    return { code: "VALIDATION", message: "Dados inválidos.", fields };
  }

  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }

  const pgCode = postgresErrorCode(error);
  if (pgCode && PG_ERROR_MAP[pgCode]) {
    return { ...PG_ERROR_MAP[pgCode] };
  }

  return null;
}
