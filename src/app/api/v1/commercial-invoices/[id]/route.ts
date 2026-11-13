import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { getInvoice } from "@/shared/server/commercial/invoices-core";

export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return restHandler(req, async (ctx) => getInvoice(ctx, (await params).id));
}
