import type { NextRequest } from "next/server";

import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/inspection-plans";
import { inspectionPlanInputSchema } from "@/shared/domains/inspections/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const sp = req.nextUrl.searchParams;
    return repo.listPlans(tenantId, {
      ...pageParamsFrom(req),
      type: sp.get("type") ?? undefined,
      status: sp.get("status") ?? undefined,
      category: sp.get("category") ?? undefined,
    });
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) =>
      repo.createPlan(tenantId, inspectionPlanInputSchema.parse(await req.json())),
    { status: 201 },
  );
}
