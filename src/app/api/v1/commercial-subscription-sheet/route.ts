import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getSubscriptionSheet } from "@/shared/server/commercial/subscription-sheet-core";

export function GET(req: NextRequest) {
  return restHandler(req, (ctx) => getSubscriptionSheet(ctx));
}
