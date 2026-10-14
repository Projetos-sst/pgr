import "server-only";

import { and, eq } from "drizzle-orm";

import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import {
  DEFAULT_PDF_BATCH_FORMAT,
  type PdfBatchFormat,
  type PdfBatchPayload,
} from "@/shared/domains/documents/pdf-batch";
import { generatedDocumentPath } from "@/shared/integrations/storage/documents-storage";

import { withOrg } from "../with-org";
import { documents } from "../schema/documents";
import { jobs } from "../schema/jobs";
import { pgr } from "../schema/pgr";
import { auditedTenantWrite } from "./audited-write";

export type EnqueuedPgrPdf = {
  documentId: string;
  jobId: string;
  pgrId: string;
  format: PdfBatchFormat;
};

/**
 * Enfileira a geração do documento de um PGR (#39) pelo template DOCX (fatia 030).
 * `format` (default `pdf`) define a extensão do `storage_path` e vai explícito no
 * payload do job. Pré-cria a linha `documents` em `generating` (com `storage_path`
 * determinístico) + o `job` `pdf_batch`, numa transação `withOrg`. O `documentId` é
 * gerado na aplicação para que o path e o payload sejam conhecidos antes do objeto
 * existir (base da idempotência).
 * PGR inexistente/cross-tenant → `FK_NOT_FOUND`.
 */
export async function enqueuePgrPdf(
  orgId: string,
  pgrId: string,
  options: { format?: PdfBatchFormat } = {},
): Promise<EnqueuedPgrPdf> {
  const format = options.format ?? DEFAULT_PDF_BATCH_FORMAT;
  return auditedTenantWrite(orgId, "documents.pdf_batch.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [exists] = await tx
        .select({ id: pgr.id })
        .from(pgr)
        .where(and(eq(pgr.orgId, orgId), eq(pgr.id, pgrId)))
        .limit(1);
      if (!exists) throw new ReferenceNotFoundError("pgr");

      const documentId = crypto.randomUUID();
      const documentGroupId = crypto.randomUUID();
      const storagePath = generatedDocumentPath(orgId, documentId, format);
      const payload: PdfBatchPayload = { documentId, kind: "pgr", pgrId, format };

      await tx.insert(documents).values({
        id: documentId,
        orgId,
        folderId: null,
        documentGroupId,
        name: "Documento PGR",
        docType: "PGR",
        version: 1,
        status: "generating",
        storagePath,
        sizeBytes: 0,
        validUntil: null,
        relatedEntityType: "pgr",
        relatedEntityId: pgrId,
      });

      const [job] = await tx
        .insert(jobs)
        .values({
          orgId,
          jobType: "pdf_batch",
          status: "pending",
          payload,
        })
        .returning({ id: jobs.id });

      return { documentId, jobId: job.id, pgrId, format };
    }),
  );
}
