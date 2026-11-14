import { NextResponse, type NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import {
  listInterests,
  registerInterest,
} from "@/shared/server/commercial/commercial-core";

export function GET(req: NextRequest) {
  const { page, pageSize } = pageParamsFrom(req);
  const search = req.nextUrl.searchParams;
  return restHandler(req, (ctx) =>
    listInterests(ctx, {
      page,
      pageSize,
      companyId: search.get("companyId") ?? undefined,
      status: search.get("status") ?? undefined,
    }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(req, async (ctx) => {
    const result = await registerInterest(ctx, await readJsonBody(req));
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  });
}
