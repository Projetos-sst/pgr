import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { getCommercialPaymentProfile } from "@/shared/server/platform/billing-portal-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return restHandler(req, (ctx) =>
    getCommercialPaymentProfile(ctx, req.nextUrl.searchParams.get("customerId")),
  );
}
