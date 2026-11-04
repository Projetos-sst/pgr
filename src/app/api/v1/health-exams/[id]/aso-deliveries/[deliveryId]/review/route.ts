import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { reviewDeliveryEvidence } from "@/shared/server/medicine/aso-delivery-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; deliveryId: string }> };

// Conferência humana do comprovante ({ method*, result*, reference* }); o revisor é o usuário da
// sessão (NOB-167).
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) => {
      const { id, deliveryId } = await context.params;
      return reviewDeliveryEvidence(ctx, id, deliveryId, await readJsonBody(req));
    },
    { status: 201 },
  );
}
