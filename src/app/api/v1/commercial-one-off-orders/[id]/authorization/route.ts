import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getOneOffAuthorization } from "@/shared/server/commercial/one-off-order-core";

type RouteContext = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: RouteContext) {
  const companyId = req.nextUrl.searchParams.get("companyId") ?? undefined;
  return restHandler(req, async (ctx) =>
    getOneOffAuthorization(ctx, (await params).id, companyId),
  );
}
