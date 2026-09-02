import {
  parseModelSuggestions,
  type GesRiskContext,
  type SuggestedRisk,
} from "@/shared/domains/pgr/ai-risk-suggestion";

import { SstAgent } from "../core/sst-agent";
import {
  RISK_SUGGESTION_INSTRUCTIONS,
  buildRiskSuggestionPrompt,
  riskSuggestionOutputSchema,
  type RiskSuggestionOutput,
} from "./prompt";

/**
 * **Agente "sugestão de riscos" (NR-01/GRO).** Recebe o contexto **não-PII** de um GES
 * (processo, ambiente, títulos de função) e devolve riscos ocupacionais candidatos, que o
 * usuário revisa e aceita antes de virarem rascunho em `risks`.
 */
export class RiskSuggestionAgent extends SstAgent<
  GesRiskContext,
  RiskSuggestionOutput,
  SuggestedRisk[]
> {
  readonly id = "risk-suggestion";
  readonly name = "Sugestão de riscos ocupacionais";
  readonly instructions = RISK_SUGGESTION_INSTRUCTIONS;
  readonly outputSchema = riskSuggestionOutputSchema;

  /** É o agente que mais escreve: um GES bem descrito rende ~12 riscos com 4 campos cada. */
  readonly maxOutputTokens = 2048;
  readonly timeoutMs = 60_000;

  buildPrompt(ctx: GesRiskContext): string {
    return buildRiskSuggestionPrompt(ctx);
  }

  /** O domínio descarta item inválido sem derrubar o lote e aplica o teto de sugestões. */
  parseOutput(raw: RiskSuggestionOutput): SuggestedRisk[] {
    return parseModelSuggestions(raw);
  }
}

export const riskSuggestionAgent = new RiskSuggestionAgent();
