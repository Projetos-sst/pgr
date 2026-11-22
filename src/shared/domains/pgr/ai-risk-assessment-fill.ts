import { z } from "zod";

import { aliasPreprocessor } from "./enum-aliases";
import {
  assessmentCriterionSchema,
  type AssessmentCriterion,
  type ExposureTime,
  type RiskAgentType,
} from "./risks";

export const AI_RISK_ASSESSMENT_FILL_KIND = "risk_assessment_fill";

export type RiskAssessmentFillContext = {
  agentType: RiskAgentType;
  hazard: string | null;
  description: string;
  sources: string | null;
  propagation: string | null;
  exposureTime: ExposureTime | null;
  possibleInjuries: string | null;
  hasMeasuredValue: boolean;
  nr09Eligible: boolean;
};

export type FilledRiskAssessment = {
  criterion: AssessmentCriterion;
  probability: number;
  severity: number;
  evaluationMethod: string | null;
  justification: string | null;
};

export type FilledAssessmentField =
  | "criterion"
  | "probability"
  | "severity"
  | "evaluationMethod";

const CRITERION_ALIASES: Record<string, AssessmentCriterion> = {
  qualitativo: "qualitative",
  qualitativa: "qualitative",
  quantitativo: "quantitative",
  quantitativa: "quantitative",
};

const normalizeCriterion = aliasPreprocessor(CRITERION_ALIASES, /^criterio\s*:?\s*/);

const scoreField = z.coerce
  .number()
  .transform((n) => Math.min(5, Math.max(1, Math.round(n))));

const nullableText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
  z.string().nullable(),
);

const modelAssessmentSchema = z.object({
  criterion: z
    .preprocess(normalizeCriterion, assessmentCriterionSchema)
    .catch("qualitative"),
  probability: scoreField,
  severity: scoreField,
  evaluationMethod: nullableText,
  justification: nullableText,
});

export function parseModelRiskAssessment(raw: unknown): FilledRiskAssessment | null {
  const parsed = modelAssessmentSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function fitAssessmentToRisk(
  assessment: FilledRiskAssessment,
  risk: Pick<RiskAssessmentFillContext, "hasMeasuredValue" | "nr09Eligible">,
): FilledRiskAssessment {
  const criterion = risk.hasMeasuredValue ? assessment.criterion : "qualitative";
  const keepMethod = criterion === "quantitative" && risk.nr09Eligible;
  return {
    ...assessment,
    criterion,
    evaluationMethod: keepMethod ? assessment.evaluationMethod : null,
  };
}

export function filledAssessmentFields(
  assessment: FilledRiskAssessment,
): FilledAssessmentField[] {
  const base: FilledAssessmentField[] = ["criterion", "probability", "severity"];
  return assessment.evaluationMethod ? [...base, "evaluationMethod"] : base;
}
