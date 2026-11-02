import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { decideItem } from "@/shared/server/medicine/exam-plan-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; itemId: string }> };

// Decisão do coordenador sobre o item (manter/retirar com justificativa, periodicidade). Sem DELETE.
export function PUT(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => {
    const { id, itemId } = await context.params;
    return decideItem(ctx, id, itemId, await readJsonBody(req));
  });
}
