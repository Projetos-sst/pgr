import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import {
  startCommercialCheckout,
  checkoutInputSchema,
} from "@/shared/server/platform/billing-checkout-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(req: NextRequest) {
  return restHandler(
    req,
    async (ctx) => {
      const body = await readJsonBody(req);
      return startCommercialCheckout(ctx, {
        ...checkoutInputSchema.omit({ key: true }).parse(body),
        key: req.headers.get("Idempotency-Key"),
      });
    },
    { status: 201 },
  );
}
