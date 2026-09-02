import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { QuotaExceededError } from "@/shared/errors/quota-exceeded-error";
import {
  FREE_AI_SUGGESTION_MONTHLY_QUOTA,
  isAiSuggestionAvailable,
} from "@/shared/tenant/plan";
import {
  AI_RISK_SUGGESTION_KIND,
  acceptSuggestedRisksInputSchema,
  toRiskValuesFromSuggestion,
  type AcceptSuggestedRisksInput,
  type SuggestedRisk,
} from "@/shared/domains/pgr/ai-risk-suggestion";
import { requestRiskSuggestions } from "@/shared/integrations/agents/risk-suggestion/agent";
import * as aiRepo from "@/shared/db/repositories/ai-risk-suggestion";
import { createRisk } from "@/shared/db/repositories/risks";

/**
 * Núcleo de orquestração da sugestão de riscos por IA, **compartilhado** entre a
 * Server Action (`officeAction`) e o mirror REST (`restHandler`) — a regra vive
 * aqui uma única vez (não reimplementada nas duas superfícies). Recebe o contexto
 * de tenant já resolvido pelo gate.
 */

export type SuggestRisksResult = { suggestions: SuggestedRisk[] };
export type AcceptSuggestedRisksResult = { created: number };

export async function runSuggestRisks(
  ctx: Pick<TenantContext, "tenantId" | "plan">,
  gesId: string,
): Promise<SuggestRisksResult> {
  // Isolamento: GES de outra org é invisível pela RLS → FK_NOT_FOUND antes do LLM.
  const context = await aiRepo.fetchGesRiskContext(ctx.tenantId, gesId);
  if (!context) throw new ReferenceNotFoundError("ges");

  // Cota por organização (mês corrente) — checada ANTES da chamada externa.
  const used = await aiRepo.countAiUsageInCurrentMonth(
    ctx.tenantId,
    AI_RISK_SUGGESTION_KIND,
  );
  if (!isAiSuggestionAvailable(ctx.plan, used)) {
    throw new QuotaExceededError(
      `Limite de ${FREE_AI_SUGGESTION_MONTHLY_QUOTA} sugestões de IA/mês do plano free atingido.`,
    );
  }

  const suggestions = await requestRiskSuggestions(context);
  await aiRepo.recordAiUsage(ctx.tenantId, AI_RISK_SUGGESTION_KIND);
  return { suggestions };
}

export async function runAcceptSuggestedRisks(
  ctx: Pick<TenantContext, "tenantId">,
  gesId: string,
  input: AcceptSuggestedRisksInput,
): Promise<AcceptSuggestedRisksResult> {
  const data = acceptSuggestedRisksInputSchema.parse(input);
  // Valida/mapeia todos antes de inserir (falha cedo; cross-tenant recusa no 1º insert).
  const values = data.suggestions.map((s) => toRiskValuesFromSuggestion(gesId, s));

  let created = 0;
  for (const v of values) {
    await createRisk(ctx.tenantId, v);
    created += 1;
  }
  return { created };
}
