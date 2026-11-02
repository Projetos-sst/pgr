import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { removeProcedure } from "@/shared/server/medicine/aso-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; procedureId: string }> };

export function DELETE(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) => {
      const { id, procedureId } = await context.params;
      await removeProcedure(ctx, id, procedureId);
    },
    { status: 204 },
  );
}
