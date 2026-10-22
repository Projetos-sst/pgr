import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import {
  getBillingCustomers,
  createBillingCustomer,
} from "@/shared/server/platform/billing-catalog-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return restHandler(req, (ctx) =>
    getBillingCustomers(ctx, req.nextUrl.searchParams.get("page") ?? 1),
  );
}
export function POST(req: NextRequest) {
  return restHandler(
    req,
    async (ctx) => createBillingCustomer(ctx, await readJsonBody(req)),
    { status: 201 },
  );
}
