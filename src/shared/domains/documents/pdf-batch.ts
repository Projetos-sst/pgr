import { z } from "zod";

const UUID_FORMAT =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const uuid = (message: string) => z.string().regex(UUID_FORMAT, message);

/** Tipo de documento gerável em lote (conjunto fechado; inicial `pgr`). */
export const pdfBatchKindSchema = z.enum(["pgr"]);
export type PdfBatchKind = z.infer<typeof pdfBatchKindSchema>;

/** Formato do arquivo gerado pelo template do PGR e guardado no GED (fatia 030). */
export const PDF_BATCH_FORMATS = ["docx", "pdf"] as const;
export const pdfBatchFormatSchema = z.enum(PDF_BATCH_FORMATS, {
  error: "Formato inválido (use docx ou pdf)",
});
export type PdfBatchFormat = z.infer<typeof pdfBatchFormatSchema>;

/** Default dos jobs novos: guardar o PDF convertido do DOCX preenchido. */
export const DEFAULT_PDF_BATCH_FORMAT: PdfBatchFormat = "pdf";
/** Payload legado sem `format` → "pdf" (a linha `documents` dele já tem path `.pdf`). */
export const LEGACY_PDF_BATCH_FORMAT: PdfBatchFormat = "pdf";
export const PROVISIONAL_PGR_DOCUMENT_NAME = "Documento PGR";

/**
 * Payload de um job `pdf_batch` — **1 job por documento** (decisão de gate #39).
 * `documentId` é a linha `documents` pré-criada em `generating` pelo enqueue.
 * `format` vive no jsonb do payload (sem migration do enum `job_type`); jobs
 * enfileirados antes da fatia 030 não o têm e caem em `LEGACY_PDF_BATCH_FORMAT`.
 */
export const pdfBatchPayloadSchema = z.object({
  documentId: uuid("documentId inválido"),
  kind: pdfBatchKindSchema,
  pgrId: uuid("pgrId inválido"),
  format: pdfBatchFormatSchema.default(LEGACY_PDF_BATCH_FORMAT),
});
export type PdfBatchPayload = z.output<typeof pdfBatchPayloadSchema>;

/** Entrada da Server Action de enfileiramento: lista não-vazia de PGRs. */
export const enqueuePgrPdfBatchSchema = z
  .array(uuid("pgrId inválido"))
  .min(1, "Informe ao menos um PGR");
export type EnqueuePgrPdfBatchInput = z.input<typeof enqueuePgrPdfBatchSchema>;
