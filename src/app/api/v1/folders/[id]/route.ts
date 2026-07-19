import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { renameFolderSchema } from "@/shared/domains/documents/folders";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { renameFolder } from "@/shared/db/repositories/folders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PUT /folders/{id} — renomeia (irmã duplicada → 409; id de outro escritório → 404). */
export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const values = renameFolderSchema.parse(await req.json());
    const row = await renameFolder(tenantId, id, values);
    if (!row) throw new NotFoundError();
    return row;
  });
}
