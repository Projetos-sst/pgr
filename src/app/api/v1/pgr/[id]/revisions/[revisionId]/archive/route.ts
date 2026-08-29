import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { archivePgrRevision } from "@/shared/db/repositories/pgr-revisions";
import { assertPgrEditable } from "@/shared/server/pgr/pgr-lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; revisionId: string }> };

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id: pgrId, revisionId } = await params;
    await assertPgrEditable(tenantId, pgrId); // mesma regra da Server Action (mirror, DRY)
    const row = await archivePgrRevision(tenantId, pgrId, revisionId);
    if (!row) throw new NotFoundError();
    return row;
  });
}
