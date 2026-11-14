import type { NextRequest } from "next/server";

import { readJsonBody } from "@/shared/api/read-json-body";
import { restHandler } from "@/shared/api/rest";
import {
  grantAccessScope,
  listAccessScopes,
} from "@/shared/server/platform/access-scope-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async (ctx) => listAccessScopes(ctx, (await params).userId), {
    tenantAccess: true,
  });
}

export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async (ctx) => grantAccessScope(ctx, (await params).userId, await readJsonBody(req)),
    { status: 201 },
  );
}
