import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import { checkoutInputSchema } from "@/shared/server/platform/billing-checkout-core";
import {
  createCommercialOrder,
  getCommercialOrders,
} from "@/shared/server/platform/billing-orders-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return restHandler(req, (ctx) =>
    getCommercialOrders(ctx, req.nextUrl.searchParams.get("page") ?? 1),
  );
}
export function POST(req: NextRequest) {
  return restHandler(
    req,
    async (ctx) => {
      const body = checkoutInputSchema.omit({ key: true }).parse(await readJsonBody(req));
      return createCommercialOrder(ctx, {
        ...body,
        key: req.headers.get("Idempotency-Key"),
      });
    },
    { status: 201 },
  );
}
