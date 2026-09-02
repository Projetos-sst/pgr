import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { QuotaExceededError } from "@/shared/errors/quota-exceeded-error";
import {
  FREE_AI_SUGGESTION_MONTHLY_QUOTA,
  isAiSuggestionAvailable,
} from "@/shared/tenant/plan";
import {
  AI_SERVICE_ORDER_KIND,
  parseModelInstructions,
  type SuggestedInstruction,
} from "@/shared/domains/safety/ai-service-order-instructions";
import { requestServiceOrderInstructions } from "@/shared/integrations/agents";
import {
  countAiUsageInCurrentMonth,
  recordAiUsage,
} from "@/shared/db/repositories/ai-risk-suggestion";
import { fetchServiceOrderInstructionContext } from "@/shared/db/repositories/ai-service-order-instructions";

/**
 * Núcleo de orquestração da **sugestão de instruções de segurança da OS**, compartilhado
 * entre a Server Action (`officeAction`) e o mirror REST (`restHandler`). Ordem: isolamento
 * (OS no tenant) → cota → contexto **não-PII** → provedor → descarte do que a OS já contém.
 *
 * **Não persiste nada, de propósito.** A coleção de itens da OS é substituída em bloco por
 * `updateServiceOrder`, que guarda as regras de OS assinada (imutável) e estado terminal.
 * Um caminho de escrita próprio aqui teria de duplicar essas guardas — e regra de
 * imutabilidade duplicada é regra que diverge. A sugestão preenche o formulário; quem grava
 * é o fluxo normal de edição, com o usuário clicando em salvar.
 */

export type SuggestServiceOrderInstructionsResult = {
  suggestions: SuggestedInstruction[];
};

export async function runSuggestServiceOrderInstructions(
  ctx: Pick<TenantContext, "tenantId" | "plan">,
  serviceOrderId: string,
): Promise<SuggestServiceOrderInstructionsResult> {
  // Isolamento: OS de outra org é invisível pela RLS → FK_NOT_FOUND antes do LLM.
  const context = await fetchServiceOrderInstructionContext(ctx.tenantId, serviceOrderId);
  if (!context) throw new ReferenceNotFoundError("Ordem de Serviço não encontrada.");

  // Cota por organização (mês corrente) — checada ANTES da chamada externa.
  const used = await countAiUsageInCurrentMonth(ctx.tenantId, AI_SERVICE_ORDER_KIND);
  if (!isAiSuggestionAvailable(ctx.plan, used)) {
    throw new QuotaExceededError(
      `Limite de ${FREE_AI_SUGGESTION_MONTHLY_QUOTA} sugestões de IA/mês do plano free atingido.`,
    );
  }

  const proposed = await requestServiceOrderInstructions(context);
  // Reaplica o filtro com os itens atuais da OS: o agente é compartilhado e não os conhece.
  const suggestions = parseModelInstructions(
    proposed.map((s) => s.description),
    context.existingItems,
  );

  // Lista vazia não entrega valor — não consome cota (mesmo critério dos demais agentes).
  if (suggestions.length > 0) {
    await recordAiUsage(ctx.tenantId, AI_SERVICE_ORDER_KIND);
  }
  return { suggestions };
}
