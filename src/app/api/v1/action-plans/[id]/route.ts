import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { actionPlanUpdateSchema } from "@/shared/domains/safety/action-plan";
import { NotFoundError } from "@/shared/errors/not-found-error";
import * as repo from "@/shared/db/repositories/action-plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const row = await repo.getActionPlanById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const input = actionPlanUpdateSchema.parse(await req.json());
    const row = await repo.updateActionPlan(tenantId, id, input);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      const deleted = await repo.deleteActionPlan(tenantId, id);
      if (!deleted) throw new NotFoundError();
    },
    { status: 204 },
  );
}
