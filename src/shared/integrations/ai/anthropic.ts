import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type {
  GesRiskContext,
  SuggestedRisk,
} from "@/shared/domains/pgr/ai-risk-suggestion";
import type { SuggestionInput } from "@/shared/domains/safety/action-plan-suggestion";
import { AiUnavailableError } from "@/shared/errors/ai-unavailable-error";

import { getAiModel, requireAnthropicApiKey } from "./config";
import {
  SUGGESTION_TOOL_NAME,
  buildRiskSuggestionPrompt,
  buildSuggestionTool,
  extractSuggestionsFromContent,
} from "./prompt";
import {
  ACTION_PLAN_TOOL_NAME,
  buildActionPlanPrompt,
  buildActionPlanTool,
  extractActionPlanFromContent,
} from "./action-plan-prompt";

/** Teto de tempo (ms) para a chamada ao provedor; estourou → `AI_UNAVAILABLE` (degradação). */
const AI_REQUEST_TIMEOUT_MS = 20_000;

/**
 * Consulta o LLM (Anthropic/Claude) e devolve os riscos sugeridos para o GES.
 * A saída é forçada via **tool use** (JSON estruturado validável por Zod). Qualquer
 * falha (chave ausente, erro de API, timeout) vira `AiUnavailableError` — jamais
 * propaga detalhe do provedor nem bloqueia o fluxo. É o único ponto de rede da
 * feature; nos testes é substituído por mock (a persistência/isolamento não o exige).
 */
export async function requestRiskSuggestions(
  ctx: GesRiskContext,
): Promise<SuggestedRisk[]> {
  const { system, user } = buildRiskSuggestionPrompt(ctx);
  const client = new Anthropic({ apiKey: requireAnthropicApiKey() });

  try {
    const response = await client.messages.create({
      model: getAiModel(),
      max_tokens: 2048,
      system,
      tools: [buildSuggestionTool()],
      tool_choice: { type: "tool", name: SUGGESTION_TOOL_NAME },
      messages: [{ role: "user", content: user }],
    });
    return extractSuggestionsFromContent(response.content);
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    throw new AiUnavailableError();
  }
}

/**
 * Consulta o LLM para sugerir um plano 5W2H a partir do input **já sanitizado** (allowlist
 * não-PII). Devolve o objeto 5W2H **cru** do `tool_use` (o core valida com Zod). Timeout e
 * qualquer falha (chave ausente, erro de API, sem bloco) viram `AiUnavailableError` — nunca
 * propaga detalhe do provedor nem bloqueia o CRUD. Único ponto de rede; mockado nos testes.
 */
export async function requestActionPlanSuggestion(
  input: SuggestionInput,
): Promise<unknown> {
  const { system, user } = buildActionPlanPrompt(input);
  const client = new Anthropic({ apiKey: requireAnthropicApiKey() });

  try {
    const response = await client.messages.create(
      {
        model: getAiModel(),
        max_tokens: 1024,
        system,
        tools: [buildActionPlanTool()],
        tool_choice: { type: "tool", name: ACTION_PLAN_TOOL_NAME },
        messages: [{ role: "user", content: user }],
      },
      { timeout: AI_REQUEST_TIMEOUT_MS },
    );
    return extractActionPlanFromContent(response.content);
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    throw new AiUnavailableError();
  }
}
