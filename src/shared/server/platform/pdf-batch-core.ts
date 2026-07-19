import "server-only";

import { and, eq } from "drizzle-orm";

import { getPgrConsolidated } from "@/shared/db/repositories/pgr-consolidated";
import { documents } from "@/shared/db/schema/documents";
import type { Job } from "@/shared/db/schema/jobs";
import { withOrg } from "@/shared/db/with-org";
import { pdfBatchPayloadSchema } from "@/shared/domains/documents/pdf-batch";
import { buildPgrHtml } from "@/shared/domains/pgr/pgr-pdf-template";
import { htmlToPdf } from "@/shared/integrations/pdf/gotenberg";
import { putGeneratedPdf } from "@/shared/integrations/storage/documents-storage";
import { todayInSaoPaulo } from "@/shared/dates";

export type ProcessResult = { documentId: string; sizeBytes: number };

/**
 * Processa um job `pdf_batch` (#39). Reusa a leitura consolidada (022) + o
 * template (#40) + o Gotenberg (#36). Idempotente: upload determinístico com
 * upsert + UPDATE da linha pré-criada para `ready`. A escrita do resultado usa
 * SEMPRE `withOrg(job.org_id)` (Princípio I). O claim/status do job fica na
 * `jobs-admin` (conexão owner) — não aqui.
 */
export async function processPdfBatchJob(job: Job): Promise<ProcessResult> {
  const payload = pdfBatchPayloadSchema.parse(job.payload);

  const data = await getPgrConsolidated(job.orgId, payload.pgrId);
  if (!data) {
    throw new Error(`PGR ${payload.pgrId} não encontrado para o org ${job.orgId}`);
  }

  const html = buildPgrHtml(data, { generatedAt: todayInSaoPaulo() });
  const pdf = await htmlToPdf(html);
  const stored = await putGeneratedPdf(job.orgId, payload.documentId, pdf);

  await withOrg(job.orgId, async (tx) => {
    await tx
      .update(documents)
      .set({
        status: "ready",
        sizeBytes: stored.sizeBytes,
        storagePath: stored.storagePath,
        name: `PGR — ${data.pgr.companyName}`,
      })
      .where(and(eq(documents.orgId, job.orgId), eq(documents.id, payload.documentId)));
  });

  return { documentId: payload.documentId, sizeBytes: stored.sizeBytes };
}
