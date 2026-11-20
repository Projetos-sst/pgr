"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";
import {
  riskAssessmentInputSchema,
  deriveAssessmentResult,
  type RiskAssessmentInput,
  type RiskAssessmentListItem,
} from "@/shared/domains/pgr/risk-assessment";
import * as repo from "@/shared/db/repositories/risk-assessments";
import { getRiskMethodologyView } from "@/shared/db/repositories/risk-methodology";
import type { RiskAssessment } from "@/shared/db/schema/risks";
import {
  runRiskAssessmentFill,
  type RiskAssessmentFillResult,
} from "@/shared/server/pgr/ai-risk-assessment-fill-core";

const basePath = (riskId: string) => `/risks/${riskId}/assessments`;

function revalidateAssessment(riskId: string, assessmentId?: string) {
  revalidatePath(`/risks/${riskId}`);
  revalidatePath(basePath(riskId));
  revalidatePath(`${basePath(riskId)}/new`);
  if (assessmentId) revalidatePath(`${basePath(riskId)}/${assessmentId}/edit`);
}

export async function listRiskAssessmentsAction(
  riskId: string,
  params: repo.ListRiskAssessmentsParams = {},
): Promise<ActionResult<Paginated<RiskAssessmentListItem>>> {
  return officeAction("pgr.risk_assessments.list", ({ tenantId }) =>
    repo.listRiskAssessments(tenantId, riskId, params),
  );
}

export async function getRiskAssessmentAction(
  id: string,
): Promise<ActionResult<RiskAssessment>> {
  return officeAction("pgr.risk_assessments.get", async ({ tenantId }) => {
    const row = await repo.getRiskAssessmentById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function getCurrentRiskAssessmentAction(
  riskId: string,
): Promise<ActionResult<RiskAssessment | null>> {
  return officeAction("pgr.risk_assessments.current", ({ tenantId }) =>
    repo.getCurrentRiskAssessment(tenantId, riskId),
  );
}

export async function createRiskAssessmentAction(
  riskId: string,
  input: RiskAssessmentInput,
): Promise<ActionResult<RiskAssessment>> {
  return officeAction(
    "pgr.risk_assessments.create",
    async ({ tenantId }) => {
      const values = riskAssessmentInputSchema.parse(input);
      const { classificationBands } = await getRiskMethodologyView(tenantId);
      const derived = deriveAssessmentResult(values, classificationBands);
      const row = await repo.createRiskAssessment(tenantId, riskId, {
        ...values,
        ...derived,
      });
      revalidateAssessment(riskId);
      return row;
    },
    { audit: true },
  );
}

export async function updateRiskAssessmentAction(
  riskId: string,
  id: string,
  input: RiskAssessmentInput,
): Promise<ActionResult<RiskAssessment>> {
  return officeAction(
    "pgr.risk_assessments.update",
    async ({ tenantId }) => {
      const values = riskAssessmentInputSchema.parse(input);
      const { classificationBands } = await getRiskMethodologyView(tenantId);
      const derived = deriveAssessmentResult(values, classificationBands);
      const row = await repo.updateRiskAssessment(tenantId, id, {
        ...values,
        ...derived,
      });
      if (!row) throw new NotFoundError();
      revalidateAssessment(riskId, id);
      return row;
    },
    { audit: true },
  );
}

export async function deleteRiskAssessmentAction(
  riskId: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.risk_assessments.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteRiskAssessment(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidateAssessment(riskId);
      return { id };
    },
    { audit: true },
  );
}

export async function fillRiskAssessmentAction(
  riskId: string,
): Promise<ActionResult<RiskAssessmentFillResult>> {
  return officeAction(
    "pgr.risk_assessments.ai_fill",
    (ctx) => runRiskAssessmentFill(ctx, riskId),
    { audit: true },
  );
}
