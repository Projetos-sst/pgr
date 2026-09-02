import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { QuotaExceededError } from "@/shared/errors/quota-exceeded-error";
import {
  FREE_AI_SUGGESTION_MONTHLY_QUOTA,
  isAiSuggestionAvailable,
} from "@/shared/tenant/plan";
import {
  AI_TRAINING_SUGGESTION_KIND,
  acceptSuggestedTrainingsInputSchema,
  matchAgainstCatalog,
  type AcceptSuggestedTrainingsInput,
  type MatchedTrainingSuggestion,
} from "@/shared/domains/pgr/ai-training-suggestion";
import { requestRequiredTrainingSuggestions } from "@/shared/integrations/agents";
import * as aiRepo from "@/shared/db/repositories/ai-risk-suggestion";
import { fetchJobRoleTrainingContext } from "@/shared/db/repositories/ai-required-trainings";
import { addRequiredTraining } from "@/shared/db/repositories/job-role-required-trainings";
import { createTrainingCatalog } from "@/shared/db/repositories/training-catalog";

/**
 * Núcleo de orquestração da **sugestão de treinamentos obrigatórios por IA**, compartilhado
 * entre a Server Action (`officeAction`) e o mirror REST (`restHandler`). Ordem: isolamento
 * (função no tenant) → cota → provedor → conciliação com o catálogo. Nada é persistido até
 * o usuário aceitar.
 */

export type SuggestRequiredTrainingsResult = {
  suggestions: MatchedTrainingSuggestion[];
};
export type AcceptSuggestedTrainingsResult = {
  linked: number;
  createdInCatalog: number;
};

export async function runSuggestRequiredTrainings(
  ctx: Pick<TenantContext, "tenantId" | "plan">,
  jobRoleId: string,
): Promise<SuggestRequiredTrainingsResult> {
  // Isolamento: função de outra org é invisível pela RLS → FK_NOT_FOUND antes do LLM.
  const context = await fetchJobRoleTrainingContext(ctx.tenantId, jobRoleId);
  if (!context) throw new ReferenceNotFoundError("Função não encontrada.");

  // Cota por organização (mês corrente) — checada ANTES da chamada externa.
  const used = await aiRepo.countAiUsageInCurrentMonth(
    ctx.tenantId,
    AI_TRAINING_SUGGESTION_KIND,
  );
  if (!isAiSuggestionAvailable(ctx.plan, used)) {
    throw new QuotaExceededError(
      `Limite de ${FREE_AI_SUGGESTION_MONTHLY_QUOTA} sugestões de IA/mês do plano free atingido.`,
    );
  }

  const proposed = await requestRequiredTrainingSuggestions(context);
  // Casa com o catálogo antes de devolver: a UI precisa saber o que já existe (vincular)
  // e o que terá de ser criado (cadastrar + vincular).
  const suggestions = matchAgainstCatalog(
    proposed,
    context.catalog,
    context.requiredTrainingIds,
  );

  // Lista vazia não entrega valor — não consome cota (mesmo critério dos demais agentes).
  if (suggestions.length > 0) {
    await aiRepo.recordAiUsage(ctx.tenantId, AI_TRAINING_SUGGESTION_KIND);
  }
  return { suggestions };
}

/**
 * Vincula os treinamentos aceitos à função. O que já existe no catálogo é apenas
 * vinculado; o que não existe é **criado no catálogo e então vinculado** — é o passo que
 * torna a sugestão utilizável, já que `job_role_required_trainings` referencia
 * `training_catalog` por FK e não aceita nome solto.
 *
 * `addRequiredTraining` é idempotente (`onConflictDoNothing` + devolve o existente), então
 * aceitar duas vezes não duplica vínculo.
 */
export async function runAcceptSuggestedTrainings(
  ctx: Pick<TenantContext, "tenantId">,
  jobRoleId: string,
  input: AcceptSuggestedTrainingsInput,
): Promise<AcceptSuggestedTrainingsResult> {
  const data = acceptSuggestedTrainingsInputSchema.parse(input);

  let linked = 0;
  let createdInCatalog = 0;
  for (const s of data.suggestions) {
    let trainingId = s.trainingId ?? null;
    if (!trainingId) {
      const created = await createTrainingCatalog(ctx.tenantId, {
        name: s.name,
        referenceNorm: s.referenceNorm,
        workloadHours: s.workloadHours,
        periodicity: s.periodicity,
        isActive: true,
        description: s.rationale,
      });
      trainingId = created.id;
      createdInCatalog += 1;
    }
    await addRequiredTraining(ctx.tenantId, { jobRoleId, trainingId });
    linked += 1;
  }
  return { linked, createdInCatalog };
}
