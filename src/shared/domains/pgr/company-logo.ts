/**
 * Validação do upload de logo da empresa (issue #4) — pura, reutilizada pela
 * Server Action antes de qualquer gravação no Storage. Só imagem (PNG/JPG),
 * teto bem menor que o do GED (`documents/files.ts`, 25 MB) porque é só um
 * ícone de identidade visual, não um documento.
 */
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/** Conjunto fechado de tipos aceitos: MIME → extensão canônica. */
export const ALLOWED_LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

export type LogoFileMeta = { name: string; size: number; type: string };

export type LogoValidationError =
  | "MISSING_FILE"
  | "EMPTY_FILE"
  | "TYPE_NOT_ALLOWED"
  | "TOO_LARGE";

export type LogoValidationResult =
  | { ok: true; extension: string }
  | { ok: false; reason: LogoValidationError; message: string };

const MESSAGES: Record<LogoValidationError, string> = {
  MISSING_FILE: "Selecione uma imagem.",
  EMPTY_FILE: "Arquivo vazio.",
  TYPE_NOT_ALLOWED: "Tipo de arquivo não permitido (use PNG ou JPG).",
  TOO_LARGE: "Imagem excede o tamanho máximo de 5 MB.",
};

export function validateLogoFile(
  file: LogoFileMeta | null | undefined,
): LogoValidationResult {
  if (!file) return fail("MISSING_FILE");
  if (file.size <= 0) return fail("EMPTY_FILE");
  if (file.size > MAX_LOGO_BYTES) return fail("TOO_LARGE");
  const extension = ALLOWED_LOGO_TYPES[file.type];
  if (!extension) return fail("TYPE_NOT_ALLOWED");
  return { ok: true, extension };
}

function fail(reason: LogoValidationError): LogoValidationResult {
  return { ok: false, reason, message: MESSAGES[reason] };
}
