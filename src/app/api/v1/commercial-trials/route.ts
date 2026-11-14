import { NextResponse, type NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import {
  listCompanyTrials,
  startCompanyTrial,
} from "@/shared/server/commercial/commercial-core";

export function GET(req: NextRequest) {
  const { page, pageSize } = pageParamsFrom(req);
  return restHandler(req, (ctx) => listCompanyTrials(ctx, { page, pageSize }));
}

export function POST(req: NextRequest) {
  return restHandler(req, async (ctx) => {
    const result = await startCompanyTrial(ctx, await readJsonBody(req));
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  });
}
