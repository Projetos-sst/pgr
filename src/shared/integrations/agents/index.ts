import "server-only";

import type {
  GesRiskContext,
  SuggestedRisk,
} from "@/shared/domains/pgr/ai-risk-suggestion";
import type {
  RiskControlContext,
  SuggestedControlMeasure,
} from "@/shared/domains/pgr/ai-control-measure-suggestion";
import type {
  JobRoleTrainingContext,
  SuggestedTraining,
} from "@/shared/domains/pgr/ai-training-suggestion";
import type { SuggestionInput } from "@/shared/domains/safety/action-plan-suggestion";
import type {
  ServiceOrderInstructionContext,
  SuggestedInstruction,
} from "@/shared/domains/safety/ai-service-order-instructions";

import { actionPlanAgent } from "./action-plan/agent";
import { controlMeasureAgent } from "./control-measure/agent";
import { mastraAiService } from "./core/mastra-ai-service";
import { requiredTrainingAgent } from "./required-training/agent";
import { riskSuggestionAgent } from "./risk-suggestion/agent";
import { serviceOrderInstructionAgent } from "./service-order-instructions/agent";

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
export {
  riskSuggestionAgent,
  actionPlanAgent,
  controlMeasureAgent,
  requiredTrainingAgent,
  serviceOrderInstructionAgent,
};

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

/** Medidas de controle candidatas para um risco, na hierarquia da NR-01. */
export async function requestControlMeasureSuggestions(
  ctx: RiskControlContext,
): Promise<SuggestedControlMeasure[]> {
  return mastraAiService.run(controlMeasureAgent, ctx);
}

/** Treinamentos exigidos por norma para uma função, ancorados nas NRs do MTE. */
export async function requestRequiredTrainingSuggestions(
  ctx: JobRoleTrainingContext,
): Promise<SuggestedTraining[]> {
  return mastraAiService.run(requiredTrainingAgent, ctx);
}

/** Instruções de segurança de uma OS, na voz imperativa (NR-01 1.4.1). */
export async function requestServiceOrderInstructions(
  ctx: ServiceOrderInstructionContext,
): Promise<SuggestedInstruction[]> {
  return mastraAiService.run(serviceOrderInstructionAgent, ctx);
}
