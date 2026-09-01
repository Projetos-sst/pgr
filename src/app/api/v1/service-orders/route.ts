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
    const signedParam = req.nextUrl.searchParams.get("signed");
    const signed =
      signedParam == null ? undefined : signedParam === "true" || signedParam === "1";
    return repo.listServiceOrders(tenantId, {
      page,
      pageSize,
      q: search,
      status,
      signed,
    });
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
