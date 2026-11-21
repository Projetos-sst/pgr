import {
  parseModelRiskAssessment,
  type FilledRiskAssessment,
  type RiskAssessmentFillContext,
} from "@/shared/domains/pgr/ai-risk-assessment-fill";

import { SstAgent } from "../core/sst-agent";
import {
  RISK_ASSESSMENT_INSTRUCTIONS,
  buildRiskAssessmentPrompt,
  riskAssessmentOutputSchema,
  type RiskAssessmentOutput,
} from "./prompt";

export class RiskAssessmentAgent extends SstAgent<
  RiskAssessmentFillContext,
  RiskAssessmentOutput,
  FilledRiskAssessment | null
> {
  readonly id = "risk-assessment";
  readonly name = "Preenchimento da avaliação de risco";
  readonly instructions = RISK_ASSESSMENT_INSTRUCTIONS;
  readonly outputSchema = riskAssessmentOutputSchema;
  readonly maxOutputTokens = 768;
  readonly timeoutMs = 60_000;

  buildPrompt(ctx: RiskAssessmentFillContext): string {
    return buildRiskAssessmentPrompt(ctx);
  }

  parseOutput(raw: RiskAssessmentOutput): FilledRiskAssessment | null {
    return parseModelRiskAssessment(raw);
  }
}

export const riskAssessmentAgent = new RiskAssessmentAgent();
