import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { markInterestSeen } from "@/shared/server/commercial/commercial-core";

type RouteContext = { params: Promise<{ id: string }> };

export function POST(req: NextRequest, { params }: RouteContext) {
  return restHandler(req, async (ctx) => markInterestSeen(ctx, (await params).id));
}
