import type { NextRequest } from "next/server";

import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/work-permits";
import { workPermitInputSchema } from "@/shared/domains/work-permits/work-permits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const sp = req.nextUrl.searchParams;
    return repo.listWorkPermits(tenantId, {
      ...pageParamsFrom(req),
      search: sp.get("search") ?? undefined,
      status: sp.get("status") ?? undefined,
      type: sp.get("type") ?? undefined,
    });
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) =>
      repo.createWorkPermit(tenantId, workPermitInputSchema.parse(await req.json())),
    { status: 201 },
  );
}
