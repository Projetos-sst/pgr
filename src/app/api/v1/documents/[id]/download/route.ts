import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { downloadFileName } from "@/shared/domains/documents/documents";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { assertPgrBillingExportAllowed } from "@/shared/db/repositories/billing-export";
import * as repo from "@/shared/db/repositories/documents";
import {
  getSignedDownloadUrl,
  SIGNED_DOWNLOAD_URL_TTL_SECONDS,
} from "@/shared/integrations/storage/documents-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /documents/{id}/download — URL assinada de curta duração (issue #35).
 * JSON `{ url, expiresInSeconds }` (mesmo padrão de `POST /pgr/{id}/signature`
 * e `POST /service-orders/{id}/signature`: o cliente decide o que fazer com a
 * URL — REST não deveria assumir "sempre browser" com um 302). Tenant
 * verificado via `getDocumentById` ANTES de assinar; `storagePath` nunca vem
 * do cliente. 404 cross-tenant (nunca revela o path nem assina nada).
 */
export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
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
