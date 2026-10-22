import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { getCommercialOrder } from "@/shared/server/platform/billing-orders-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async (ctx) => getCommercialOrder(ctx, (await params).id));
}
