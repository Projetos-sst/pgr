import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { removeGesFromPgr } from "@/shared/db/repositories/pgr-ges";
import { assertPgrEditable } from "@/shared/server/pgr/pgr-lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; gesId: string }> };

export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id: pgrId, gesId } = await params;
      await assertPgrEditable(tenantId, pgrId);
      const deleted = await removeGesFromPgr(tenantId, pgrId, gesId);
      if (!deleted) throw new NotFoundError();
    },
    { status: 204 },
  );
}
