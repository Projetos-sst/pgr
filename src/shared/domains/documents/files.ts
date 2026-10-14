/**
 * Validação de arquivo do GED (fatia 024) — pura, reutilizada por Server Action e
 * REST antes de qualquer gravação (Storage/DB). Tipos e teto confirmados no clarify:
 * PDF, PNG, JPG, DOC/DOCX, XLS/XLSX; máximo 25 MB.
 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Conjunto fechado de tipos aceitos: MIME → extensão canônica. */
export const ALLOWED_FILE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export type FileMeta = { name: string; size: number; type: string };

export type FileValidationError =
  "MISSING_FILE" | "EMPTY_FILE" | "MISSING_NAME" | "TYPE_NOT_ALLOWED" | "TOO_LARGE";

export type FileValidationResult =
  | { ok: true; extension: string }
  | { ok: false; reason: FileValidationError; message: string };

const MESSAGES: Record<FileValidationError, string> = {
  MISSING_FILE: "Arquivo é obrigatório.",
  EMPTY_FILE: "Arquivo vazio.",
  MISSING_NAME: "Arquivo sem nome.",
  TYPE_NOT_ALLOWED: "Tipo de arquivo não permitido (use PDF, imagem, DOC ou XLS).",
  TOO_LARGE: "Arquivo excede o tamanho máximo de 25 MB.",
};

export function validateFile(file: FileMeta | null | undefined): FileValidationResult {
  if (!file) return fail("MISSING_FILE");
  if (!file.name || file.name.trim() === "") return fail("MISSING_NAME");
  if (file.size <= 0) return fail("EMPTY_FILE");
  if (file.size > MAX_FILE_BYTES) return fail("TOO_LARGE");
  const extension = ALLOWED_FILE_TYPES[file.type];
  if (!extension) return fail("TYPE_NOT_ALLOWED");
  return { ok: true, extension };
}

function fail(reason: FileValidationError): FileValidationResult {
  return { ok: false, reason, message: MESSAGES[reason] };
}
