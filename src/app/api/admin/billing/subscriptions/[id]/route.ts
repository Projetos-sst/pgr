import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { getAdminCommercialSubscription } from "@/shared/server/platform/billing-admin-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async (ctx) =>
    getAdminCommercialSubscription(ctx, (await params).id),
  );
}
