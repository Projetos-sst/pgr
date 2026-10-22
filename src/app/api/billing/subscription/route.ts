import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { getCommercialSubscriptions } from "@/shared/server/platform/billing-subscriptions-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return restHandler(req, (ctx) => getCommercialSubscriptions(ctx));
}
