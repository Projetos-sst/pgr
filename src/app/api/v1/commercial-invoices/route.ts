import type { NextRequest } from "next/server";

import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import { listInvoices } from "@/shared/server/commercial/invoices-core";

export function GET(req: NextRequest) {
  const { page, pageSize } = pageParamsFrom(req);
  const contractId = req.nextUrl.searchParams.get("contractId") ?? undefined;
  return restHandler(req, (ctx) => listInvoices(ctx, { page, pageSize, contractId }));
}
