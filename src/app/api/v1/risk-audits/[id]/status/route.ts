import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { riskAuditStatusTransitionSchema } from "@/shared/domains/safety/risk-audit";
import { NotFoundError } from "@/shared/errors/not-found-error";
import * as repo from "@/shared/db/repositories/risk-audits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const { status, justification } = riskAuditStatusTransitionSchema.parse(
      await req.json(),
    );
    const row = await repo.transitionRiskAudit(tenantId, id, status, justification);
    if (!row) throw new NotFoundError();
    return row;
  });
}
