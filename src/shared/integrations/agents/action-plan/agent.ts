import type { SuggestionInput } from "@/shared/domains/safety/action-plan-suggestion";

import { SstAgent } from "../core/sst-agent";
import {
  ACTION_PLAN_INSTRUCTIONS,
  actionPlanOutputSchema,
  buildActionPlanPrompt,
  normalizeActionPlanOutput,
  type ActionPlanOutput,
} from "./prompt";

/**
 * **Agente "plano de ação 5W2H" (NR-01/GRO).** A partir de um risco ou incidente **já
 * sanitizado** (allowlist não-PII), propõe um plano corretivo para pré-preencher o
 * formulário. Devolve o objeto normalizado mas ainda **cru**: quem valida com o schema
 * `.strict()` do domínio é o core, que trata saída inválida como `AI_UNAVAILABLE` em vez
 * de erro do usuário.
 */
export class ActionPlanAgent extends SstAgent<
  SuggestionInput,
  ActionPlanOutput,
  unknown
> {
  readonly id = "action-plan";
  readonly name = "Sugestão de plano de ação 5W2H";
  readonly instructions = ACTION_PLAN_INSTRUCTIONS;
  readonly outputSchema = actionPlanOutputSchema;

  /**
   * Um plano só (oito campos), mas 'como' costuma vir em passos numerados. Com 1024 uma
   * resposta em ~4 execuções saía truncada e era rejeitada pelo schema `.strict()`.
   */
  readonly maxOutputTokens = 1536;
  readonly timeoutMs = 40_000;

  buildPrompt(input: SuggestionInput): string {
    return buildActionPlanPrompt(input);
  }

  parseOutput(raw: ActionPlanOutput): unknown {
    return normalizeActionPlanOutput(raw);
  }
}

export const actionPlanAgent = new ActionPlanAgent();
