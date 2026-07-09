import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type {
  GesRiskContext,
  SuggestedRisk,
} from "@/shared/domains/pgr/ai-risk-suggestion";
import { AiUnavailableError } from "@/shared/errors/ai-unavailable-error";

import { getAiModel, requireAnthropicApiKey } from "./config";
import {
  SUGGESTION_TOOL_NAME,
  buildRiskSuggestionPrompt,
  buildSuggestionTool,
  extractSuggestionsFromContent,
} from "./prompt";

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
