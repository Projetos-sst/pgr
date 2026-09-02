import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { QuotaExceededError } from "@/shared/errors/quota-exceeded-error";
import {
  FREE_AI_SUGGESTION_MONTHLY_QUOTA,
  isAiSuggestionAvailable,
} from "@/shared/tenant/plan";
import {
  AI_CONTROL_MEASURE_KIND,
  acceptSuggestedMeasuresInputSchema,
  dropExistingLevels,
  toControlMeasureValuesFromSuggestion,
  type AcceptSuggestedMeasuresInput,
  type SuggestedControlMeasure,
} from "@/shared/domains/pgr/ai-control-measure-suggestion";
import { requestControlMeasureSuggestions } from "@/shared/integrations/agents";
import * as aiRepo from "@/shared/db/repositories/ai-risk-suggestion";
import { fetchRiskControlContext } from "@/shared/db/repositories/ai-control-measures";
import { createControlMeasure } from "@/shared/db/repositories/control-measures";
import { isModeratePlusClassification } from "@/shared/domains/pgr/control-measure";

/**
 * Núcleo de orquestração da **sugestão de medidas de controle por IA**, compartilhado
 * entre a Server Action (`officeAction`) e o mirror REST (`restHandler`) — a regra vive
 * aqui uma única vez. Ordem: isolamento (risco no tenant) → cota → provedor → descarte dos
 * níveis já cadastrados. Nada é persistido até o usuário aceitar.
 */

export type SuggestControlMeasuresResult = {
  suggestions: SuggestedControlMeasure[];
  /**
   * Risco moderado ou superior: a regra da issue #42 exige responsável e prazo em toda
   * medida aplicável. Vai no retorno para a tela poder cobrar os dois **antes** do aceite,
   * em vez de deixar o usuário perder o lote num `VALIDATION` do servidor.
   */
  requiresResponsibleAndDeadline: boolean;
};
export type AcceptSuggestedMeasuresResult = { created: number };

export async function runSuggestControlMeasures(
  ctx: Pick<TenantContext, "tenantId" | "plan">,
  riskId: string,
): Promise<SuggestControlMeasuresResult> {
  // Isolamento: risco de outra org é invisível pela RLS → FK_NOT_FOUND antes do LLM.
  const context = await fetchRiskControlContext(ctx.tenantId, riskId);
  if (!context) throw new ReferenceNotFoundError("Risco não encontrado.");

  // Cota por organização (mês corrente) — checada ANTES da chamada externa.
  const used = await aiRepo.countAiUsageInCurrentMonth(
    ctx.tenantId,
    AI_CONTROL_MEASURE_KIND,
  );
  if (!isAiSuggestionAvailable(ctx.plan, used)) {
    throw new QuotaExceededError(
      `Limite de ${FREE_AI_SUGGESTION_MONTHLY_QUOTA} sugestões de IA/mês do plano free atingido.`,
    );
  }

  const proposed = await requestControlMeasureSuggestions(context);
  // A UNIQUE (org, risco, nível) recusaria o aceite; melhor não oferecer o que já existe.
  const suggestions = dropExistingLevels(proposed, context.existingLevels);

  // Lista vazia não entrega valor — não consome cota (mesmo critério da sugestão de riscos).
  if (suggestions.length > 0) {
    await aiRepo.recordAiUsage(ctx.tenantId, AI_CONTROL_MEASURE_KIND);
  }
  return {
    suggestions,
    requiresResponsibleAndDeadline: isModeratePlusClassification(context.classification),
  };
}

/**
 * Persiste as medidas selecionadas/revisadas em `control_measures` reusando
 * `createControlMeasure` — que aplica a regra de status pela classificação vigente e
 * espelha a medida no Plano de Ação, na mesma transação.
 */
export async function runAcceptSuggestedMeasures(
  ctx: Pick<TenantContext, "tenantId">,
  riskId: string,
  input: AcceptSuggestedMeasuresInput,
): Promise<AcceptSuggestedMeasuresResult> {
  const data = acceptSuggestedMeasuresInputSchema.parse(input);
  // Valida/mapeia todas antes de inserir (falha cedo; cross-tenant recusa no 1º insert).
  const values = data.suggestions.map(toControlMeasureValuesFromSuggestion);

  let created = 0;
  for (const v of values) {
    await createControlMeasure(ctx.tenantId, riskId, v);
    created += 1;
  }
  return { created };
}
