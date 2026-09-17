import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { validateFile } from "@/shared/domains/documents/files";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import * as repo from "@/shared/db/repositories/documents";
import { listDocumentVersions } from "@/shared/db/repositories/document-versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /documents/{id}/versions — histórico do documento lógico (#56): mais nova primeiro,
 * `isCurrent` em exatamente uma. Qualquer versão do grupo serve de entrada; outro
 * escritório → 404.
 */
export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const versions = await listDocumentVersions(tenantId, id);
    if (!versions) throw new NotFoundError();
    return versions;
  });
}

/**
 * POST /documents/{id}/versions — nova versão (vigente + 1 no grupo, herda metadados da
 * vigente); upload multipart.
 */
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      const formData = await req.formData();
      const raw = formData.get("file");
      const file = raw instanceof File ? raw : null;
      const check = validateFile(file);
      if (!check.ok) throw new ValidationError(check.message);

      const row = await repo.addDocumentVersion(tenantId, id, file!);
      if (!row) throw new NotFoundError();
      return row;
    },
    { status: 201 },
  );
}
