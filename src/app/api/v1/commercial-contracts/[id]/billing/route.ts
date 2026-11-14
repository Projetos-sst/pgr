import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getContractBilling } from "@/shared/server/commercial/billing-events-core";

export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async (ctx) => getContractBilling(ctx, (await params).id));
}
