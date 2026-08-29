/**
 * Validação da foto de item do catálogo de EPI (issue #30) — pura, reutilizada
 * pelo Server Action antes de qualquer gravação no Storage. Mesmo critério das
 * issues #4 (logo de empresas) e #16 (foto de funcionário), para manter
 * consistência entre os campos de imagem do produto: PNG/JPG, máximo 5 MB.
 */
export const MAX_EPI_CATALOG_PHOTO_BYTES = 5 * 1024 * 1024;

/** Conjunto fechado de tipos aceitos: MIME → extensão canônica. */
export const ALLOWED_EPI_CATALOG_PHOTO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

export type EpiCatalogPhotoFileMeta = { size: number; type: string };

export type EpiCatalogPhotoValidationError =
  | "MISSING_FILE"
  | "EMPTY_FILE"
  | "TYPE_NOT_ALLOWED"
  | "TOO_LARGE";

export type EpiCatalogPhotoValidationResult =
  | { ok: true; extension: string }
  | { ok: false; reason: EpiCatalogPhotoValidationError; message: string };

const MESSAGES: Record<EpiCatalogPhotoValidationError, string> = {
  MISSING_FILE: "Selecione uma foto.",
  EMPTY_FILE: "Arquivo vazio.",
  TYPE_NOT_ALLOWED: "Formato não permitido (use PNG ou JPG).",
  TOO_LARGE: "Foto excede o tamanho máximo de 5 MB.",
};

export function validateEpiCatalogPhotoFile(
  file: EpiCatalogPhotoFileMeta | null | undefined,
): EpiCatalogPhotoValidationResult {
  if (!file) return fail("MISSING_FILE");
  if (file.size <= 0) return fail("EMPTY_FILE");
  if (file.size > MAX_EPI_CATALOG_PHOTO_BYTES) return fail("TOO_LARGE");
  const extension = ALLOWED_EPI_CATALOG_PHOTO_TYPES[file.type];
  if (!extension) return fail("TYPE_NOT_ALLOWED");
  return { ok: true, extension };
}

function fail(reason: EpiCatalogPhotoValidationError): EpiCatalogPhotoValidationResult {
  return { ok: false, reason, message: MESSAGES[reason] };
}
