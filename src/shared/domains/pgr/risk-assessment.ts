import { z } from "zod";

import { optionalString } from "./form-fields";
import {
  assessmentCriterionSchema,
  assessmentCriterionLabel,
  measurementUnitSchema,
  uncertaintyDegreeLabel,
  computeRiskLevel,
  type AssessmentCriterion,
  type MeasurementUnit,
} from "./risks";
import { nr09ConclusionSchema, type Nr09Conclusion } from "./nr09";
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
export type {
  AssessmentCriterion,
  RiskClassification,
  ClassificationBand,
  Nr09Conclusion,
};

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
 * Decimal opcional em string (`""` → `undefined`) — as colunas NR-09 são `numeric` e o
 * Drizzle/postgres-js as expõem como string. Mesmo padrão de `concentrationIntensity`
 * no domínio do risco.
 */
function optionalDecimal(message: string) {
  return z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional()
    .refine((v) => v === undefined || /^\d+(\.\d+)?$/.test(v), { message });
}

const optionalMeasurementUnit = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  measurementUnitSchema.optional(),
);

const optionalNr09Conclusion = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  nr09ConclusionSchema.optional(),
);

/**
 * Campos persistidos que o cliente informa. **Não** inclui `riskLevel`/`result`
 * (calculados no servidor), `riskId` (vem da rota) nem `orgId` (vem da sessão).
 * O bloco NR-09 (#39) é opcional e só vale no critério quantitativo — ver
 * `refineRiskAssessment`.
 */
const riskAssessmentBaseObject = z.object({
  criterion: assessmentCriterionSchema,
  probability: probabilityField,
  severity: severityField,
  uncertaintyDegree: uncertaintyField,
  toleranceLimit: optionalString,
  assessedAt: z.iso.date("Data da avaliação inválida (use AAAA-MM-DD)"),
  // NR-09 (#39)
  evaluationMethod: optionalString,
  measuredValue: optionalDecimal("Valor medido deve ser um número decimal válido"),
  measuredUnit: optionalMeasurementUnit,
  toleranceLimitValue: optionalDecimal(
    "Limite de tolerância deve ser um número decimal válido",
  ),
  nr09Conclusion: optionalNr09Conclusion,
});

type RiskAssessmentBase = z.infer<typeof riskAssessmentBaseObject>;

/**
 * Regras do bloco NR-09, iguais aos CHECKs do banco (a aplicação explica, o banco
 * garante):
 *
 * 1. campo quantitativo só no critério `quantitative`;
 * 2. valor medido exige unidade **quantitativa** (medição sem unidade não é medição).
 */
function refineRiskAssessment(data: RiskAssessmentBase, ctx: z.RefinementCtx): void {
  const nr09Fields = [
    ["evaluationMethod", data.evaluationMethod],
    ["measuredValue", data.measuredValue],
    ["measuredUnit", data.measuredUnit],
    ["toleranceLimitValue", data.toleranceLimitValue],
    ["nr09Conclusion", data.nr09Conclusion],
  ] as const;

  if (data.criterion !== "quantitative") {
    for (const [path, value] of nr09Fields) {
      if (value !== undefined) {
        ctx.addIssue({
          path: [path],
          code: "custom",
          message: "Avaliação quantitativa (NR-09) exige critério quantitativo",
        });
      }
    }
    return;
  }

  if (data.measuredValue !== undefined) {
    if (!data.measuredUnit || data.measuredUnit === "qualitative_na") {
      ctx.addIssue({
        path: ["measuredUnit"],
        code: "custom",
        message: "Informe a unidade de medida do valor medido",
      });
    }
  }
}

export const riskAssessmentInputSchema =
  riskAssessmentBaseObject.superRefine(refineRiskAssessment);

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
  // NR-09 (#39) — `null` em toda avaliação qualitativa e nas quantitativas sem medição.
  evaluationMethod: string | null;
  measuredValue: string | null;
  measuredUnit: MeasurementUnit | null;
  toleranceLimitValue: string | null;
  nr09Conclusion: Nr09Conclusion | null;
};
