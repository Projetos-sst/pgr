import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import {
  DEFAULT_PDF_BATCH_FORMAT,
  PROVISIONAL_PGR_DOCUMENT_NAME,
  type PdfBatchFormat,
  type PdfBatchPayload,
} from "@/shared/domains/documents/pdf-batch";
import { generatedDocumentPath } from "@/shared/integrations/storage/documents-storage";

import { withOrg, type TenantTransaction } from "../with-org";
import { documents } from "../schema/documents";
import { jobs } from "../schema/jobs";
import { pgr } from "../schema/pgr";
import { auditedTenantWrite } from "./audited-write";
import { getCurrentVersionTx } from "./document-versions";

export type EnqueuedPgrPdf = {
  documentId: string;
  jobId: string;
  pgrId: string;
  format: PdfBatchFormat;
};

async function currentPgrDocumentTx(tx: TenantTransaction, orgId: string, pgrId: string) {
  const [latest] = await tx
    .select({ documentGroupId: documents.documentGroupId })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        eq(documents.relatedEntityType, "pgr"),
        eq(documents.relatedEntityId, pgrId),
        eq(documents.docType, "PGR"),
      ),
    )
    .orderBy(desc(documents.createdAt))
    .limit(1);
  if (!latest) return null;
  return getCurrentVersionTx(tx, orgId, latest.documentGroupId);
}

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
        .limit(1)
        .for("update");
      if (!exists) throw new ReferenceNotFoundError("pgr");

      const current = await currentPgrDocumentTx(tx, orgId, pgrId);
      const documentId = crypto.randomUUID();
      const documentGroupId = current?.documentGroupId ?? crypto.randomUUID();
      const version = (current?.version ?? 0) + 1;
      const storagePath = generatedDocumentPath(orgId, documentId, format);
      const payload: PdfBatchPayload = { documentId, kind: "pgr", pgrId, format };

      await tx.insert(documents).values({
        id: documentId,
        orgId,
        folderId: current?.folderId ?? null,
        documentGroupId,
        name: current?.name ?? PROVISIONAL_PGR_DOCUMENT_NAME,
        docType: "PGR",
        version,
        status: "generating",
        storagePath,
        sizeBytes: 0,
        validUntil: current?.validUntil ?? null,
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
