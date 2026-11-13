import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import { getCustomer, updateCustomer } from "@/shared/server/commercial/commercial-core";

type RouteContext = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: RouteContext) {
  return restHandler(req, async (ctx) => getCustomer(ctx, (await params).id));
}

export function PUT(req: NextRequest, { params }: RouteContext) {
  return restHandler(req, async (ctx) =>
    updateCustomer(ctx, (await params).id, await readJsonBody(req)),
  );
}
