import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { documents } from "@/shared/db/schema/documents";
import type { Job } from "@/shared/db/schema/jobs";
import { withOrg } from "@/shared/db/with-org";
import {
  PROVISIONAL_PGR_DOCUMENT_NAME,
  pdfBatchPayloadSchema,
  type PdfBatchFormat,
} from "@/shared/domains/documents/pdf-batch";
import { putGeneratedDocument } from "@/shared/integrations/storage/documents-storage";
import { generatePgrDocx } from "@/shared/server/platform/pgr-docx-core";

export type ProcessResult = {
  documentId: string;
  sizeBytes: number;
  format: PdfBatchFormat;
};

/**
 * Processa um job `pdf_batch` (#39). O documento do PGR sai do template DOCX
 * (`generatePgrDocx`, fatia 030 — padrão Salesbud): DOCX preenchido com os dados do
 * PGR do tenant do job, ou PDF convertido a partir dele (`format` do payload; legado
 * sem `format` → pdf). Idempotente: upload determinístico com upsert + UPDATE da
 * linha pré-criada para `ready`. A leitura e a escrita do resultado usam SEMPRE
 * `job.orgId` (Princípio I). `NotFoundError`/`ReportUnavailableError` propagam — o
 * worker faz retry até `failed`. O claim/status do job fica na `jobs-admin`.
 */
export async function processPdfBatchJob(job: Job): Promise<ProcessResult> {
  const payload = pdfBatchPayloadSchema.parse(job.payload);

  const generated = await generatePgrDocx(job.orgId, payload.pgrId, {
    format: payload.format,
  });
  const stored = await putGeneratedDocument(
    job.orgId,
    payload.documentId,
    generated.file,
    {
      format: payload.format,
      contentType: generated.contentType,
    },
  );

  await withOrg(job.orgId, async (tx) => {
    await tx
      .update(documents)
      .set({
        status: "ready",
        sizeBytes: stored.sizeBytes,
        storagePath: stored.storagePath,
        name: sql`case when ${documents.name} = ${PROVISIONAL_PGR_DOCUMENT_NAME} then ${generated.title} else ${documents.name} end`,
      })
      .where(and(eq(documents.orgId, job.orgId), eq(documents.id, payload.documentId)));
  });

  return {
    documentId: payload.documentId,
    sizeBytes: stored.sizeBytes,
    format: payload.format,
  };
}

export async function discardPdfBatchDocument(job: Job): Promise<void> {
  const parsed = pdfBatchPayloadSchema.safeParse(job.payload);
  if (!parsed.success) return;
  await withOrg(job.orgId, async (tx) => {
    await tx
      .delete(documents)
      .where(
        and(
          eq(documents.orgId, job.orgId),
          eq(documents.id, parsed.data.documentId),
          eq(documents.status, "generating"),
        ),
      );
  });
}
