import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getOneOffOrder } from "@/shared/server/commercial/one-off-order-core";

type RouteContext = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: RouteContext) {
  return restHandler(req, async (ctx) => getOneOffOrder(ctx, (await params).id));
}
