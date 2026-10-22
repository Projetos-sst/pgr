import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { getCommercialOverview } from "@/shared/server/platform/commercial-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return restHandler(req, (ctx) =>
    getCommercialOverview(ctx, req.nextUrl.searchParams.get("page") ?? 1),
  );
}
