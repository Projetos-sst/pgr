import "server-only";

import type { SuggestionInput } from "@/shared/domains/safety/action-plan-suggestion";

import { runToolCall } from "../openrouter-client";
import { buildActionPlanPrompt, buildActionPlanTool, extractActionPlan } from "./prompt";

/**
 * **Agente "plano de ação 5W2H" (NR-01/GRO).** A partir de um risco ou incidente **já
 * sanitizado** (allowlist não-PII), propõe um plano corretivo 5W2H para pré-preencher o
 * formulário. Devolve o objeto **cru** — quem valida com Zod é o core, que trata saída
 * inválida como `AI_UNAVAILABLE` em vez de erro do usuário.
 */
export async function requestActionPlanSuggestion(
  input: SuggestionInput,
): Promise<unknown> {
  const { system, user } = buildActionPlanPrompt(input);
  const calls = await runToolCall({
    system,
    user,
    tool: buildActionPlanTool(),
    maxTokens: 1024,
  });
  return extractActionPlan(calls);
}
