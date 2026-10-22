import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import {
  getCommercialInterests,
  registerCommercialInterest,
} from "@/shared/server/platform/billing-interests-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return restHandler(req, (ctx) =>
    getCommercialInterests(ctx, {
      page: req.nextUrl.searchParams.get("page") ?? 1,
      status: req.nextUrl.searchParams.get("status") ?? undefined,
      companyId: req.nextUrl.searchParams.get("companyId") ?? undefined,
    }),
  );
}
export function POST(req: NextRequest) {
  return restHandler(
    req,
    async (ctx) => registerCommercialInterest(ctx, await readJsonBody(req)),
    { status: 201 },
  );
}
