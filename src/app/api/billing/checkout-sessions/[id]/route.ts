import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { getCommercialCheckoutSession } from "@/shared/server/platform/billing-checkout-session-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async (ctx) =>
    getCommercialCheckoutSession(ctx, (await params).id),
  );
}
