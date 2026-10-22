import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { getCommercialCharges } from "@/shared/server/platform/billing-charges-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return restHandler(req, (ctx) =>
    getCommercialCharges(ctx, {
      page: req.nextUrl.searchParams.get("page") ?? 1,
      companyId: req.nextUrl.searchParams.get("companyId") ?? undefined,
    }),
  );
}
