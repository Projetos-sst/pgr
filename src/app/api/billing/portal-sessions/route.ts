import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import {
  openCommercialPortal,
  portalInputSchema,
} from "@/shared/server/platform/billing-portal-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(req: NextRequest) {
  return restHandler(
    req,
    async (ctx) => {
      const body = portalInputSchema.omit({ key: true }).parse(await readJsonBody(req));
      return openCommercialPortal(ctx, {
        ...body,
        key: req.headers.get("Idempotency-Key"),
      });
    },
    { status: 201 },
  );
}
