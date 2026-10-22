import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { getAdminCommercialSubscriptions } from "@/shared/server/platform/billing-admin-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return restHandler(req, (ctx) =>
    getAdminCommercialSubscriptions(ctx, Object.fromEntries(req.nextUrl.searchParams)),
  );
}
