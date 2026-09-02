import "server-only";

import type {
  GesRiskContext,
  SuggestedRisk,
} from "@/shared/domains/pgr/ai-risk-suggestion";
import type { SuggestionInput } from "@/shared/domains/safety/action-plan-suggestion";

import { actionPlanAgent } from "./action-plan/agent";
import { mastraAiService } from "./core/mastra-ai-service";
import { riskSuggestionAgent } from "./risk-suggestion/agent";

/**
 * Ponto de entrada da camada de agentes: é aqui que a **definição** de cada agente
 * (declarativa e pura) encontra o **executor** (`MastraAiService`). Os cores importam
 * daqui e não conhecem nem o Mastra nem o provedor — trocar de framework mexe neste
 * arquivo e no serviço, em mais nada.
 *
 * Agente novo = definir a classe em `<nome>/agent.ts` e exportar a fachada aqui.
 */

export { mastraAiService, MastraAiService } from "./core/mastra-ai-service";
export { SstAgent } from "./core/sst-agent";
export { riskSuggestionAgent, actionPlanAgent };

/** Riscos ocupacionais candidatos para um GES, a partir do contexto não-PII. */
export async function requestRiskSuggestions(
  ctx: GesRiskContext,
): Promise<SuggestedRisk[]> {
  return mastraAiService.run(riskSuggestionAgent, ctx);
}

/** Plano 5W2H sugerido para um risco/incidente já sanitizado. Saída validada no core. */
export async function requestActionPlanSuggestion(
  input: SuggestionInput,
): Promise<unknown> {
  return mastraAiService.run(actionPlanAgent, input);
}
