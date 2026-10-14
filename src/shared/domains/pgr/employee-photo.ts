/**
 * Validação do upload de foto do funcionário (issue #16) — pura, reutilizada
 * pela Server Action antes de qualquer gravação no Storage. Mesmo padrão e
 * mesmo teto de `company-logo.ts` (issue #4, upload de logo de empresa): só
 * imagem (PNG/JPG), 5 MB — bem menor que o do GED (`documents/files.ts`, 25 MB)
 * porque não é um documento, é um asset de identificação visual.
 */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Conjunto fechado de tipos aceitos: MIME → extensão canônica. */
export const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

export type PhotoFileMeta = { name: string; size: number; type: string };

export type PhotoValidationError =
  "MISSING_FILE" | "EMPTY_FILE" | "TYPE_NOT_ALLOWED" | "TOO_LARGE";

export type PhotoValidationResult =
  | { ok: true; extension: string }
  | { ok: false; reason: PhotoValidationError; message: string };

const MESSAGES: Record<PhotoValidationError, string> = {
  MISSING_FILE: "Selecione uma imagem.",
  EMPTY_FILE: "Arquivo vazio.",
  TYPE_NOT_ALLOWED: "Tipo de arquivo não permitido (use PNG ou JPG).",
  TOO_LARGE: "Imagem excede o tamanho máximo de 5 MB.",
};

export function validatePhotoFile(
  file: PhotoFileMeta | null | undefined,
): PhotoValidationResult {
  if (!file) return fail("MISSING_FILE");
  if (file.size <= 0) return fail("EMPTY_FILE");
  if (file.size > MAX_PHOTO_BYTES) return fail("TOO_LARGE");
  const extension = ALLOWED_PHOTO_TYPES[file.type];
  if (!extension) return fail("TYPE_NOT_ALLOWED");
  return { ok: true, extension };
}

function fail(reason: PhotoValidationError): PhotoValidationResult {
  return { ok: false, reason, message: MESSAGES[reason] };
}
