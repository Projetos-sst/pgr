import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import {
  getCommercialTrial,
  startCommercialTrial,
} from "@/shared/server/platform/billing-trials-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return restHandler(req, (ctx) =>
    getCommercialTrial(ctx, req.nextUrl.searchParams.get("companyId")),
  );
}
export function POST(req: NextRequest) {
  return restHandler(
    req,
    async (ctx) => startCommercialTrial(ctx, await readJsonBody(req)),
    { status: 201 },
  );
}
