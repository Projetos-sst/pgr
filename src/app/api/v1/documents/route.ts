import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import {
  documentMetadataSchema,
  type DocumentValidityFilter,
} from "@/shared/domains/documents/documents";
import { validateFile } from "@/shared/domains/documents/files";
import { ValidationError } from "@/shared/errors/validation-error";
import * as repo from "@/shared/db/repositories/documents";
import { listFolderTree } from "@/shared/db/repositories/folders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALIDITY_FILTERS = new Set(["ok", "due_soon", "expired", "no_expiry"]);

function paramsFrom(req: NextRequest): repo.ListDocumentsParams {
  const sp = req.nextUrl.searchParams;
  const folderIdRaw = sp.get("folderId");
  const validityRaw = sp.get("validity");
  return {
    ...pageParamsFrom(req),
    folderId: folderIdRaw && folderIdRaw !== "" ? folderIdRaw : null,
    docType: sp.get("docType") ?? undefined,
    validity: VALIDITY_FILTERS.has(validityRaw ?? "")
      ? (validityRaw as DocumentValidityFilter)
      : undefined,
  };
}

/** GET /documents — lista (versão corrente) + KPIs + árvore de pastas + breadcrumb. */
export function GET(req: NextRequest) {
  return restHandler(req, async ({ tenantId }) => {
    const params = paramsFrom(req);
    const [list, tree] = await Promise.all([
      repo.listDocuments(tenantId, params),
      listFolderTree(tenantId, params.folderId ?? null),
    ]);
    return {
      rows: list.rows,
      total: list.total,
      kpis: list.kpis,
      folders: tree.folders,
      breadcrumb: tree.breadcrumb,
    };
  });
}

/** POST /documents — upload multipart (arquivo + metadados); cria v1/novo grupo. */
export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const formData = await req.formData();
      const raw = formData.get("file");
      const file = raw instanceof File ? raw : null;
      const check = validateFile(file);
      if (!check.ok) throw new ValidationError(check.message);

      const metadata = documentMetadataSchema.parse({
        name: formData.get("name"),
        docType: formData.get("docType"),
        validUntil: formData.get("validUntil") ?? "",
        folderId: formData.get("folderId") ?? "",
        relatedEntityType: formData.get("relatedEntityType") ?? undefined,
        relatedEntityId: formData.get("relatedEntityId") ?? "",
      });

      return repo.createDocument(tenantId, { metadata, file: file! });
    },
    { status: 201 },
  );
}
