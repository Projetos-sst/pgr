import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
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
    const { id: riskId } = await params;
    return repo.listRiskAssessments(tenantId, riskId, pageParamsFrom(req));
  });
}

export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id: riskId } = await params;
      const values = riskAssessmentInputSchema.parse(await req.json());
      const { classificationBands } = await getRiskMethodologyView(tenantId);
      const derived = deriveAssessmentResult(values, classificationBands);
      return repo.createRiskAssessment(tenantId, riskId, { ...values, ...derived });
    },
    { status: 201 },
  );
}
