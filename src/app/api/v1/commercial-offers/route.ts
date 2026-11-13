import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { listSellableOffers } from "@/shared/server/commercial/commercial-core";

export function GET(req: NextRequest) {
  return restHandler(req, (ctx) => listSellableOffers(ctx));
}
