import {
  parseModelEpiLinks,
  type EpiRiskFillContext,
  type SuggestedEpiLink,
} from "@/shared/domains/pgr/ai-epi-risk-fill";

import { SstAgent } from "../core/sst-agent";
import {
  EPI_RISK_INSTRUCTIONS,
  buildEpiRiskPrompt,
  epiRiskOutputSchema,
  type EpiRiskOutput,
} from "./prompt";

export class EpiRiskAgent extends SstAgent<
  EpiRiskFillContext,
  EpiRiskOutput,
  SuggestedEpiLink[]
> {
  readonly id = "epi-risk";
  readonly name = "Preenchimento de EPIs do risco";
  readonly instructions = EPI_RISK_INSTRUCTIONS;
  readonly outputSchema = epiRiskOutputSchema;
  readonly maxOutputTokens = 1536;
  readonly timeoutMs = 60_000;

  buildPrompt(ctx: EpiRiskFillContext): string {
    return buildEpiRiskPrompt(ctx);
  }

  parseOutput(raw: EpiRiskOutput): SuggestedEpiLink[] {
    return parseModelEpiLinks(raw);
  }
}

export const epiRiskAgent = new EpiRiskAgent();
