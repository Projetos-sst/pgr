import type { NextRequest } from "next/server";
import { z } from "zod";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import { billingReasonSchema } from "@/shared/domains/billing/contracts";
import { reconcileAdminCommercialSubscription } from "@/shared/server/platform/billing-admin-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async (ctx) => {
    const body = z
      .object({ reason: billingReasonSchema })
      .strict()
      .parse(await readJsonBody(req));
    return reconcileAdminCommercialSubscription(ctx, {
      contractId: (await params).id,
      ...body,
    });
  });
}
