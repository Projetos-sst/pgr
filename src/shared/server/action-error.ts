import { ZodError } from "zod";

import { AppError } from "@/shared/errors/app-error";

import type { ActionError } from "./result";

const PG_ERROR_MAP: Record<string, { code: string; message: string }> = {
  "23505": { code: "DUPLICATE", message: "Registro já existe neste escritório." },
  "23503": { code: "FK_NOT_FOUND", message: "Referência inexistente neste escritório." },
  "23514": { code: "VALIDATION", message: "Valor fora do permitido." },
  "23502": { code: "VALIDATION", message: "Campo obrigatório ausente." },
};

function postgresErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
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
