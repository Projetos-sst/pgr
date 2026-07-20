import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { moveDocumentSchema } from "@/shared/domains/documents/documents";
import { NotFoundError } from "@/shared/errors/not-found-error";
import * as repo from "@/shared/db/repositories/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST /documents/{id}/move — move o documento lógico (todas as versões) de pasta. */
export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const { folderId } = moveDocumentSchema.parse(await req.json());
    const row = await repo.moveDocument(tenantId, id, folderId);
    if (!row) throw new NotFoundError();
    return row;
  });
}
