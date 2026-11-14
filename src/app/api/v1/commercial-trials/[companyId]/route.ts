import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getCompanyTrial } from "@/shared/server/commercial/commercial-core";

type RouteContext = { params: Promise<{ companyId: string }> };

export function GET(req: NextRequest, { params }: RouteContext) {
  return restHandler(req, async (ctx) => getCompanyTrial(ctx, (await params).companyId));
}
