import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { validateCommercialPortal } from "@/shared/server/platform/billing-portal-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async (ctx) =>
    validateCommercialPortal(ctx, (await params).id),
  );
}
