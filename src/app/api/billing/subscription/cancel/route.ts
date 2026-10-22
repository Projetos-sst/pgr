import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import { cancelCommercialSubscription } from "@/shared/server/platform/billing-management-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(req: NextRequest) {
  return restHandler(req, async (ctx) =>
    cancelCommercialSubscription(ctx, await readJsonBody(req)),
  );
}
