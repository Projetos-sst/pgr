import { z } from "zod";

import { optionalString } from "./form-fields";
import {
  assessmentCriterionSchema,
  assessmentCriterionLabel,
  uncertaintyDegreeLabel,
  computeRiskLevel,
  type AssessmentCriterion,
} from "./risks";
import {
  classify,
  riskClassificationLabel,
  type RiskClassification,
  type ClassificationBand,
} from "./methodology";

/**
 * Domínio puro da avaliação de risco (matriz 5×5) — issue #25. Espelha as colunas
 * de `risk_assessments` (schema `db/schema/risks.ts`, migration `0012`) em Zod e
 * reúsa a matriz (`computeRiskLevel`) e a classificação (`classify`) já existentes.
 * `risk_level`/`result` são **calculados no servidor** (não entram no input).
 */

export type { RiskAssessment } from "@/shared/db/schema/risks";
export {
  assessmentCriterionLabel,
  uncertaintyDegreeLabel,
  riskClassificationLabel,
  computeRiskLevel,
  classify,
};
export type { AssessmentCriterion, RiskClassification, ClassificationBand };

// ---------------------------------------------------------------------------
// Schema de entrada (create E update — corpo completo)
// ---------------------------------------------------------------------------

/** Probabilidade 1–5 (coerção string→número para servir form e REST-JSON). */
const probabilityField = z.coerce
  .number({ error: "Probabilidade é obrigatória" })
  .int("Probabilidade deve ser um inteiro")
  .min(1, "Probabilidade deve estar entre 1 e 5")
  .max(5, "Probabilidade deve estar entre 1 e 5");

/** Severidade 1–5 (coerção string→número). */
const severityField = z.coerce
  .number({ error: "Severidade é obrigatória" })
  .int("Severidade deve ser um inteiro")
  .min(1, "Severidade deve estar entre 1 e 5")
  .max(5, "Severidade deve estar entre 1 e 5");

/** Grau de incerteza 0–2 (default 0). */
const uncertaintyField = z.coerce
  .number()
  .int("Grau de incerteza deve ser um inteiro")
  .min(0, "Grau de incerteza deve estar entre 0 e 2")
  .max(2, "Grau de incerteza deve estar entre 0 e 2")
  .default(0);

/**
 * Campos persistidos que o cliente informa. **Não** inclui `riskLevel`/`result`
 * (calculados no servidor), `riskId` (vem da rota) nem `orgId` (vem da sessão).
 */
export const riskAssessmentInputSchema = z.object({
  criterion: assessmentCriterionSchema,
  probability: probabilityField,
  severity: severityField,
  uncertaintyDegree: uncertaintyField,
  toleranceLimit: optionalString,
  assessedAt: z.iso.date("Data da avaliação inválida (use AAAA-MM-DD)"),
});

export type RiskAssessmentInput = z.input<typeof riskAssessmentInputSchema>;
export type RiskAssessmentValues = z.output<typeof riskAssessmentInputSchema>;

/** Valores prontos para o repositório: input validado + derivados no servidor. */
export type RiskAssessmentWriteValues = RiskAssessmentValues & {
  riskLevel: number;
  result: RiskClassification;
};

/**
 * Deriva `riskLevel` (= probabilidade × severidade) e `result` (classificação pela
 * metodologia da organização) — função **pura**, coração testável da fatia. O
 * `result` é o snapshot gravado no momento da avaliação.
 */
export function deriveAssessmentResult(
  values: Pick<RiskAssessmentValues, "probability" | "severity">,
  bands: ClassificationBand[],
): { riskLevel: number; result: RiskClassification } {
  const riskLevel = computeRiskLevel(values.probability, values.severity);
  return { riskLevel, result: classify(riskLevel, bands) };
}

// ---------------------------------------------------------------------------
// Rótulos normativos pt-BR
// ---------------------------------------------------------------------------

export const PROBABILITY_LABELS: Record<number, string> = {
  1: "Rara",
  2: "Pouco provável",
  3: "Possível",
  4: "Provável",
  5: "Muito provável",
};

export const SEVERITY_LABELS: Record<number, string> = {
  1: "Leve, sem necessidade de atenção médica",
  2: "Séria, reversível",
  3: "Crítica, irreversível",
  4: "Incapacitante ou mortal individual",
  5: "Mortes ou incapacitantes múltiplas",
};

export function probabilityLabel(value: number): string {
  return PROBABILITY_LABELS[value] ?? String(value);
}

export function severityLabel(value: number): string {
  return SEVERITY_LABELS[value] ?? String(value);
}

// ---------------------------------------------------------------------------
// Projeções (list/detail)
// ---------------------------------------------------------------------------

/**
 * Item do histórico. `createdAt` é `Date` (coluna `timestamp` → Drizzle retorna
 * objeto Date); `assessedAt` é `string` (coluna `date` → "AAAA-MM-DD").
 */
export type RiskAssessmentListItem = {
  id: string;
  criterion: AssessmentCriterion;
  probability: number;
  severity: number;
  riskLevel: number;
  uncertaintyDegree: number;
  toleranceLimit: string | null;
  result: RiskClassification | null;
  assessedAt: string;
  createdAt: Date;
};
