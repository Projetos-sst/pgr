import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { updateDocumentSchema } from "@/shared/domains/documents/documents";
import { NotFoundError } from "@/shared/errors/not-found-error";
import * as repo from "@/shared/db/repositories/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /documents/{id} — detalhe (inclui storagePath e vínculo). */
export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const row = await repo.getDocumentById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

/** PUT /documents/{id} — edita metadados (não troca arquivo; isso é /versions). */
export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const patch = updateDocumentSchema.parse(await req.json());
    const row = await repo.updateDocument(tenantId, id, patch);
    if (!row) throw new NotFoundError();
    return row;
  });
}

/** DELETE /documents/{id} — remove o documento lógico inteiro (todas as versões). */
export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      const result = await repo.deleteDocument(tenantId, id);
      if (!result) throw new NotFoundError();
    },
    { status: 204 },
  );
}
