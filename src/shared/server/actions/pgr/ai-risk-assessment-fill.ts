"use server";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  runRiskAssessmentFill,
  type RiskAssessmentFillResult,
} from "@/shared/server/pgr/ai-risk-assessment-fill-core";

export async function fillRiskAssessmentAction(
  riskId: string,
): Promise<ActionResult<RiskAssessmentFillResult>> {
  return officeAction(
    "pgr.risk_assessments.ai_fill",
    (ctx) => runRiskAssessmentFill(ctx, riskId),
    { audit: true },
  );
}
