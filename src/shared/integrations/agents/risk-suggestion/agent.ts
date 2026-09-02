import "server-only";

import type {
  GesRiskContext,
  SuggestedRisk,
} from "@/shared/domains/pgr/ai-risk-suggestion";

import { runToolCall } from "../openrouter-client";
import {
  buildRiskSuggestionPrompt,
  buildSuggestionTool,
  extractSuggestions,
} from "./prompt";

/**
 * **Agente "sugestão de riscos" (NR-01/GRO).** Recebe o contexto **não-PII** de um GES
 * (processo, ambiente, títulos de função) e devolve riscos ocupacionais candidatos, que o
 * usuário revisa e aceita antes de virarem rascunho em `risks`. Falha do provedor vira
 * `AiUnavailableError` no transporte — nunca bloqueia o cadastro manual.
 *
 * Teto de tempo maior que o default: um GES bem descrito rende ~12 riscos e a resposta
 * medida chegou a ~20s. É o agente que mais escreve, e o mais lento.
 */
const RISK_SUGGESTION_TIMEOUT_MS = 45_000;
export async function requestRiskSuggestions(
  ctx: GesRiskContext,
): Promise<SuggestedRisk[]> {
  const { system, user } = buildRiskSuggestionPrompt(ctx);
  const calls = await runToolCall({
    system,
    user,
    tool: buildSuggestionTool(),
    maxTokens: 2048,
    timeoutMs: RISK_SUGGESTION_TIMEOUT_MS,
  });
  return extractSuggestions(calls);
}
