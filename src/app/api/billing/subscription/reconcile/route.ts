import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import { reconcileCommercialSubscription } from "@/shared/server/platform/billing-subscriptions-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(req: NextRequest) {
  return restHandler(req, async (ctx) =>
    reconcileCommercialSubscription(ctx, await readJsonBody(req)),
  );
}
