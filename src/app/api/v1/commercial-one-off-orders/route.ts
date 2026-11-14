import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import {
  createOneOffOrder,
  listOneOffOrders,
} from "@/shared/server/commercial/one-off-order-core";

export function GET(req: NextRequest) {
  const { page, pageSize } = pageParamsFrom(req);
  const params = req.nextUrl.searchParams;
  const companyId = params.get("companyId") ?? undefined;
  const status = params.get("status") ?? undefined;
  return restHandler(req, (ctx) =>
    listOneOffOrders(ctx, { page, pageSize, companyId, status }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async (ctx) => createOneOffOrder(ctx, await readJsonBody(req)),
    { status: 201 },
  );
}
