import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import {
  serviceOrderCreateSchema,
  serviceOrderStatusSchema,
} from "@/shared/domains/safety/service-order";
import * as repo from "@/shared/db/repositories/service-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const { page, pageSize, search } = pageParamsFrom(req);
    const statusParam = req.nextUrl.searchParams.get("status");
    const status = statusParam ? serviceOrderStatusSchema.parse(statusParam) : undefined;
    return repo.listServiceOrders(tenantId, { page, pageSize, q: search, status });
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = serviceOrderCreateSchema.parse(await req.json());
      return repo.createServiceOrder(tenantId, input);
    },
    { status: 201 },
  );
}
