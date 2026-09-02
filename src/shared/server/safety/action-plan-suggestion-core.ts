import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { QuotaExceededError } from "@/shared/errors/quota-exceeded-error";
import { AiUnavailableError } from "@/shared/errors/ai-unavailable-error";
import {
  FREE_AI_SUGGESTION_MONTHLY_QUOTA,
  isAiSuggestionAvailable,
} from "@/shared/tenant/plan";
import {
  ACTION_PLAN_SUGGESTION_KIND,
  actionPlanSuggestionSchema,
  sanitizeIncidentSuggestionContext,
  sanitizeRiskSuggestionContext,
  type ActionPlanSuggestion,
} from "@/shared/domains/safety/action-plan-suggestion";
import type { ActionPlanOriginType } from "@/shared/domains/safety/action-plan-origin";
import { requestActionPlanSuggestion } from "@/shared/integrations/agents";
import {
  countAiUsageInCurrentMonth,
  recordAiUsage,
} from "@/shared/db/repositories/ai-risk-suggestion";
import { getSuggestionOriginContext } from "@/shared/db/repositories/risk-audits";

/**
 * Núcleo de orquestração da **sugestão de plano 5W2H por IA** (Fase 06 / US7), compartilhado
 * entre a Server Action (`officeAction`) e o mirror REST (`restHandler`). A regra vive aqui uma
 * única vez. Ordem: isolamento (origem no tenant) → cota → input **sanitizado** (allowlist) →
 * provedor → validação Zod → registro de uso. Falha da IA **nunca** persiste plano nem toca a
 * auditoria — só retorna a sugestão para preencher o formulário (degradação graciosa, SC-012).
 */

export type SuggestActionPlanResult = { suggestion: ActionPlanSuggestion };

export async function runSuggestActionPlan(
  ctx: Pick<TenantContext, "tenantId" | "plan">,
  originType: ActionPlanOriginType,
  originId: string,
): Promise<SuggestActionPlanResult> {
  // Isolamento: origem de outra org é invisível pela RLS → FK_NOT_FOUND antes de cota/LLM.
  const raw = await getSuggestionOriginContext(ctx.tenantId, originType, originId);
  if (!raw) throw new ReferenceNotFoundError("origin");

  // Cota por organização (mês corrente), checada ANTES da chamada externa.
  const used = await countAiUsageInCurrentMonth(
    ctx.tenantId,
    ACTION_PLAN_SUGGESTION_KIND,
  );
  if (!isAiSuggestionAvailable(ctx.plan, used)) {
    throw new QuotaExceededError(
      `Limite de ${FREE_AI_SUGGESTION_MONTHLY_QUOTA} sugestões de IA/mês do plano free atingido.`,
    );
  }

  // Input **sanitizado** por allowlist (P0): nunca nome/CPF/hospital/lesão/testemunhas/CAT.
  const input =
    originType === "risk"
      ? sanitizeRiskSuggestionContext(raw)
      : sanitizeIncidentSuggestionContext(raw);

  const modelOutput = await requestActionPlanSuggestion(input);

  // Saída inválida do provedor → indisponibilidade controlada (não vira VALIDATION do cliente).
  const parsed = actionPlanSuggestionSchema.safeParse(modelOutput);
  if (!parsed.success) throw new AiUnavailableError();

  // Uso registrado só após sucesso (falha da IA não consome cota).
  await recordAiUsage(ctx.tenantId, ACTION_PLAN_SUGGESTION_KIND);
  return { suggestion: parsed.data };
}
