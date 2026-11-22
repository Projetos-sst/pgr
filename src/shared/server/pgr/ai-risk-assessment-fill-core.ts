import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { QuotaExceededError } from "@/shared/errors/quota-exceeded-error";
import {
  FREE_AI_SUGGESTION_MONTHLY_QUOTA,
  isAiSuggestionAvailable,
} from "@/shared/tenant/plan";
import {
  AI_RISK_ASSESSMENT_FILL_KIND,
  fitAssessmentToRisk,
  type FilledRiskAssessment,
} from "@/shared/domains/pgr/ai-risk-assessment-fill";
import { requestRiskAssessmentFill } from "@/shared/integrations/agents";
import * as aiRepo from "@/shared/db/repositories/ai-risk-suggestion";
import { fetchRiskAssessmentFillContext } from "@/shared/db/repositories/ai-risk-assessment-fill";

export type RiskAssessmentFillResult = { assessment: FilledRiskAssessment | null };

export async function runRiskAssessmentFill(
  ctx: Pick<TenantContext, "tenantId" | "plan">,
  riskId: string,
): Promise<RiskAssessmentFillResult> {
  const context = await fetchRiskAssessmentFillContext(ctx.tenantId, riskId);
  if (!context) throw new ReferenceNotFoundError("Risco não encontrado.");

  const used = await aiRepo.countAiUsageInCurrentMonth(
    ctx.tenantId,
    AI_RISK_ASSESSMENT_FILL_KIND,
  );
  if (!isAiSuggestionAvailable(ctx.plan, used)) {
    throw new QuotaExceededError(
      `Limite de ${FREE_AI_SUGGESTION_MONTHLY_QUOTA} sugestões de IA/mês do plano free atingido.`,
    );
  }

  const proposed = await requestRiskAssessmentFill(context);
  if (!proposed) return { assessment: null };
  await aiRepo.recordAiUsage(ctx.tenantId, AI_RISK_ASSESSMENT_FILL_KIND);
  return { assessment: fitAssessmentToRisk(proposed, context) };
}
