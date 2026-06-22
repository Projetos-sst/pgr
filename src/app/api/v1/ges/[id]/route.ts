import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { gesInputSchema } from "@/shared/domains/pgr/ges";
import * as repo from "@/shared/db/repositories/ges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const row = await repo.getGesById(tenantId, id);
    if (!row) throw new NotFoundError();
    const exposedWorkers = await repo.countExposedWorkersByGes(tenantId, id);
    return { ...row, exposedWorkers };
  });
}

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const input = gesInputSchema.parse(await req.json());
    const row = await repo.updateGes(tenantId, id, input);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      const deleted = await repo.deleteGes(tenantId, id);
      if (!deleted) throw new NotFoundError();
    },
    { status: 204 },
  );
}
