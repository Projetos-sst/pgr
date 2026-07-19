import { z } from "zod";

const UUID_FORMAT =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const uuid = (message: string) => z.string().regex(UUID_FORMAT, message);

/** Tipo de documento gerável em lote (conjunto fechado; inicial `pgr`). */
export const pdfBatchKindSchema = z.enum(["pgr"]);
export type PdfBatchKind = z.infer<typeof pdfBatchKindSchema>;

/**
 * Payload de um job `pdf_batch` — **1 job por documento** (decisão de gate #39).
 * `documentId` é a linha `documents` pré-criada em `generating` pelo enqueue.
 */
export const pdfBatchPayloadSchema = z.object({
  documentId: uuid("documentId inválido"),
  kind: pdfBatchKindSchema,
  pgrId: uuid("pgrId inválido"),
});
export type PdfBatchPayload = z.infer<typeof pdfBatchPayloadSchema>;

/** Entrada da Server Action de enfileiramento: lista não-vazia de PGRs. */
export const enqueuePgrPdfBatchSchema = z
  .array(uuid("pgrId inválido"))
  .min(1, "Informe ao menos um PGR");
export type EnqueuePgrPdfBatchInput = z.input<typeof enqueuePgrPdfBatchSchema>;
