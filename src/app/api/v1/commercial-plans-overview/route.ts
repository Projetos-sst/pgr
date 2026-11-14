import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getPlansOverview } from "@/shared/server/commercial/plans-overview-core";

export function GET(req: NextRequest) {
  return restHandler(req, (ctx) => getPlansOverview(ctx));
}
