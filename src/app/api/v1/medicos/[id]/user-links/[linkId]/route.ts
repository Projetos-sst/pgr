import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { revoke } from "@/shared/server/medicine/professional-links-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; linkId: string }> };

// PUT só revoga ({ reason }); sem DELETE: o histórico de vínculos é preservado.
export function PUT(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => {
    const { id, linkId } = await context.params;
    return revoke(ctx, id, linkId, await readJsonBody(req));
  });
}
