import {
  parseModelSuggestions,
  type GesRiskContext,
  type RiskFillFocus,
  type SuggestedRisk,
} from "@/shared/domains/pgr/ai-risk-suggestion";

import { SstAgent } from "../core/sst-agent";
import {
  RISK_SUGGESTION_INSTRUCTIONS,
  buildRiskSuggestionPrompt,
  riskSuggestionOutputSchema,
  type RiskSuggestionOutput,
} from "./prompt";

export type RiskSuggestionRequest = GesRiskContext & { focus?: RiskFillFocus };

/**
 * **Agente "sugestão de riscos" (NR-01/GRO).** Recebe o contexto **não-PII** de um GES
 * (processo, ambiente, títulos de função) e devolve riscos ocupacionais candidatos, que o
 * usuário revisa e aceita antes de virarem rascunho em `risks`.
 */
export class RiskSuggestionAgent extends SstAgent<
  RiskSuggestionRequest,
  RiskSuggestionOutput,
  SuggestedRisk[]
> {
  readonly id = "risk-suggestion";
  readonly name = "Sugestão de riscos ocupacionais";
  readonly instructions = RISK_SUGGESTION_INSTRUCTIONS;
  readonly outputSchema = riskSuggestionOutputSchema;

  readonly maxOutputTokens = 4096;
  readonly timeoutMs = 60_000;

  buildPrompt(request: RiskSuggestionRequest): string {
    return buildRiskSuggestionPrompt(request, request.focus);
  }

  /** O domínio descarta item inválido sem derrubar o lote e aplica o teto de sugestões. */
  parseOutput(raw: RiskSuggestionOutput): SuggestedRisk[] {
    return parseModelSuggestions(raw);
  }
}

export const riskSuggestionAgent = new RiskSuggestionAgent();
