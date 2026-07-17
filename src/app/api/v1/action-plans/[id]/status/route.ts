import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { actionPlanStatusTransitionSchema } from "@/shared/domains/safety/action-plan";
import { NotFoundError } from "@/shared/errors/not-found-error";
import * as repo from "@/shared/db/repositories/action-plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const { status } = actionPlanStatusTransitionSchema.parse(await req.json());
    const row = await repo.setActionPlanStatus(tenantId, id, status);
    if (!row) throw new NotFoundError();
    return row;
  });
}
