import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import {
  listCustomers,
  registerCustomer,
} from "@/shared/server/commercial/commercial-core";

export function GET(req: NextRequest) {
  const { page, pageSize } = pageParamsFrom(req);
  const search = req.nextUrl.searchParams;
  return restHandler(req, (ctx) =>
    listCustomers(ctx, {
      page,
      pageSize,
      kind: search.get("kind") ?? undefined,
      status: search.get("status") ?? undefined,
    }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(req, async (ctx) => registerCustomer(ctx, await readJsonBody(req)), {
    status: 201,
  });
}
