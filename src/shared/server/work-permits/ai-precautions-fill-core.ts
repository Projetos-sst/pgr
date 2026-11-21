import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { QuotaExceededError } from "@/shared/errors/quota-exceeded-error";
import {
  FREE_AI_SUGGESTION_MONTHLY_QUOTA,
  isAiSuggestionAvailable,
} from "@/shared/tenant/plan";
import {
  AI_WORK_PERMIT_PRECAUTIONS_KIND,
  buildPrecautionsContext,
  parseModelPrecautions,
  workPermitPrecautionsFillInputSchema,
} from "@/shared/domains/work-permits/ai-precautions-fill";
import { requestWorkPermitPrecautionsFill } from "@/shared/integrations/agents";
import * as aiRepo from "@/shared/db/repositories/ai-risk-suggestion";

export type WorkPermitPrecautionsFillResult = { precautions: string[] };

export async function runWorkPermitPrecautionsFill(
  ctx: Pick<TenantContext, "tenantId" | "plan">,
  input: unknown,
): Promise<WorkPermitPrecautionsFillResult> {
  const context = buildPrecautionsContext(
    workPermitPrecautionsFillInputSchema.parse(input),
  );

  const used = await aiRepo.countAiUsageInCurrentMonth(
    ctx.tenantId,
    AI_WORK_PERMIT_PRECAUTIONS_KIND,
  );
  if (!isAiSuggestionAvailable(ctx.plan, used)) {
    throw new QuotaExceededError(
      `Limite de ${FREE_AI_SUGGESTION_MONTHLY_QUOTA} sugestões de IA/mês do plano free atingido.`,
    );
  }

  const proposed = await requestWorkPermitPrecautionsFill(context);
  const precautions = parseModelPrecautions(proposed, context.existingPrecautions);
  if (precautions.length === 0) return { precautions };
  await aiRepo.recordAiUsage(ctx.tenantId, AI_WORK_PERMIT_PRECAUTIONS_KIND);
  return { precautions };
}
