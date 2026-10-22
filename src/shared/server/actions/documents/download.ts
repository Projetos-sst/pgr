"use server";

import { downloadFileName } from "@/shared/domains/documents/documents";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { assertPgrBillingExportAllowed } from "@/shared/db/repositories/billing-export";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import * as repo from "@/shared/db/repositories/documents";
import {
  getSignedDownloadUrl,
  SIGNED_DOWNLOAD_URL_TTL_SECONDS,
} from "@/shared/integrations/storage/documents-storage";

export type DownloadDocumentResult = { url: string; expiresInSeconds: number };

/**
 * Devolve uma URL assinada de curta duração para baixar o documento (issue
 * #35). O tenant é verificado via `getDocumentById` (mesmo caminho de leitura
 * do detalhe) ANTES de assinar — `storagePath` nunca vem do cliente, sempre do
 * registro já escopado pelo tenant da sessão. 404 se o documento não existe ou
 * é de outro escritório (nunca revela o path nem assina nada nesse caso).
 */
export async function downloadDocumentAction(
  id: string,
): Promise<ActionResult<DownloadDocumentResult>> {
  return officeAction("documents.documents.download", async ({ tenantId }) => {
    const doc = await repo.getDocumentById(tenantId, id);
    if (!doc) throw new NotFoundError();
    if (doc.relatedEntityType === "pgr" && doc.relatedEntityId)
      await assertPgrBillingExportAllowed(tenantId, doc.relatedEntityId);

    const url = await getSignedDownloadUrl(doc.storagePath, {
      downloadName: downloadFileName(doc.name, doc.storagePath),
    });
    return { url, expiresInSeconds: SIGNED_DOWNLOAD_URL_TTL_SECONDS };
  });
}
