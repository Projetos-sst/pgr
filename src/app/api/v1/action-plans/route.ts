import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import {
  actionPlanCreateSchema,
  actionPlanFiltersSchema,
} from "@/shared/domains/safety/action-plan";
import * as repo from "@/shared/db/repositories/action-plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => {
    const { page, pageSize, search } = pageParamsFrom(req);
    const sp = req.nextUrl.searchParams;
    const filters = actionPlanFiltersSchema.parse({
      page,
      pageSize,
      q: search,
      status: sp.get("status") ?? undefined,
      type: sp.get("type") ?? undefined,
      priority: sp.get("priority") ?? undefined,
      originType: sp.get("origin_type") ?? undefined,
      originId: sp.get("origin_id") ?? undefined,
      whenFrom: sp.get("when_from") ?? undefined,
      whenTo: sp.get("when_to") ?? undefined,
      overdue: sp.get("overdue") ?? undefined,
    });
    return repo.listActionPlans(tenantId, filters);
  });
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = actionPlanCreateSchema.parse(await req.json());
      return repo.createActionPlan(tenantId, input);
    },
    { status: 201 },
  );
}
