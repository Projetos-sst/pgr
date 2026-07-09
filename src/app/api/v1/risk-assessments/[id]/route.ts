import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import {
  riskAssessmentInputSchema,
  deriveAssessmentResult,
} from "@/shared/domains/pgr/risk-assessment";
import * as repo from "@/shared/db/repositories/risk-assessments";
import { getRiskMethodologyView } from "@/shared/db/repositories/risk-methodology";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const row = await repo.getRiskAssessmentById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const values = riskAssessmentInputSchema.parse(await req.json());
    const { classificationBands } = await getRiskMethodologyView(tenantId);
    const derived = deriveAssessmentResult(values, classificationBands);
    const row = await repo.updateRiskAssessment(tenantId, id, { ...values, ...derived });
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      const deleted = await repo.deleteRiskAssessment(tenantId, id);
      if (!deleted) throw new NotFoundError();
    },
    { status: 204 },
  );
}
