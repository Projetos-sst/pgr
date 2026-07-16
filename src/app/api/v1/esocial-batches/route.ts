import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/esocial-events";
import { NotFoundError } from "@/shared/errors/not-found-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => repo.listBatches(tenantId));
}

// POST { eventIds: string[] } — envia (agrupa) eventos pending num lote.
export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const body = (await req.json()) as { eventIds?: unknown };
      const ids = Array.isArray(body.eventIds) ? body.eventIds.map(String) : [];
      const result = await repo.sendBatch(tenantId, ids);
      if (!result) throw new NotFoundError();
      return result;
    },
    { status: 201 },
  );
}
