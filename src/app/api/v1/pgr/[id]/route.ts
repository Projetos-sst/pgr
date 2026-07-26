import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { pgrInputSchema } from "@/shared/domains/pgr/pgr";
import * as repo from "@/shared/db/repositories/pgr";
import { assertPgrEditable } from "@/shared/server/pgr/pgr-lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const row = await repo.getPgrById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const values = pgrInputSchema.parse(await req.json());
    await assertPgrEditable(tenantId, id);
    const row = await repo.updatePgr(tenantId, id, values);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      const deleted = await repo.deletePgr(tenantId, id);
      if (!deleted) throw new NotFoundError();
    },
    { status: 204 },
  );
}
