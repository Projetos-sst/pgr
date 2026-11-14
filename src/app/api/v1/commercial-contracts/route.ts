import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import {
  listContracts,
  registerContract,
} from "@/shared/server/commercial/commercial-core";

export function GET(req: NextRequest) {
  const { page, pageSize } = pageParamsFrom(req);
  const customerId = req.nextUrl.searchParams.get("customerId") ?? undefined;
  return restHandler(req, (ctx) => listContracts(ctx, { page, pageSize, customerId }));
}

export function POST(req: NextRequest) {
  return restHandler(req, async (ctx) => registerContract(ctx, await readJsonBody(req)), {
    status: 201,
  });
}
