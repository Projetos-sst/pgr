import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { voidDelivery } from "@/shared/server/medicine/aso-delivery-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; deliveryId: string }> };

// Corrige um registro de entrega ou pedido ({ reason* }); o original é preservado (NOB-165).
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) => {
      const { id, deliveryId } = await context.params;
      return voidDelivery(ctx, id, deliveryId, await readJsonBody(req));
    },
    { status: 201 },
  );
}
