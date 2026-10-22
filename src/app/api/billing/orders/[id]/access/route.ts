import { z } from "zod";
import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import { requirePurchasedService } from "@/shared/server/platform/billing-orders-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async (ctx) => {
    const body = z
      .object({ companyId: z.guid(), product: z.enum(["pgr", "medicine"]) })
      .strict()
      .parse(await readJsonBody(req));
    return requirePurchasedService(ctx, { ...body, orderId: (await params).id });
  });
}
