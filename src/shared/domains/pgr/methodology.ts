import { z } from "zod";

import { computeRiskLevel } from "./risks";
import { optionalString, requiredString } from "./form-fields";

/**
 * Metodologia de avaliação de riscos (matriz 5×5 configurável) — issue #76.
 *
 * A organização define os rótulos/descrições das gradações de probabilidade e
 * severidade (1–5) e as faixas que classificam o nível de risco (`prob × sev`,
 * 1–25) em Trivial / Tolerável / Moderado / Substancial / Intolerável.
 *
 * A matriz 5×5 **não é armazenada célula a célula**: guardam-se apenas as faixas
 * e a classe de cada uma das 25 células é **derivada** por `classify(...)`.
 */

/** Classes de risco, em ordem **crescente** de gravidade (canônica). */
export const RISK_CLASSIFICATION_ORDER = [
  "trivial",
  "tolerable",
  "moderate",
  "substantial",
  "intolerable",
] as const;

export const riskClassificationSchema = z.enum(RISK_CLASSIFICATION_ORDER);
export const methodologyBaseSchema = z.enum([
  "aiha",
  "as_nzs_4360",
  "fundacentro",
  "custom",
]);

export type RiskClassification = z.infer<typeof riskClassificationSchema>;
export type MethodologyBase = z.infer<typeof methodologyBaseSchema>;

/** Menor e maior nível de risco possíveis numa matriz 5×5 (`prob × sev`). */
export const MIN_RISK_LEVEL = 1;
export const MAX_RISK_LEVEL = 25;

/** Uma gradação (probabilidade ou severidade): nível fixo 1–5 + rótulo + descrição. */
export const methodologyGradeSchema = z.object({
  level: z.number().int().min(1).max(5),
  label: requiredString("Rótulo é obrigatório"),
  description: optionalString,
});

export type MethodologyGrade = z.infer<typeof methodologyGradeSchema>;

/**
 * Conjunto das 5 gradações de um eixo: exatamente 5 itens, um por nível 1..5, em
 * ordem. Isso garante que a UI sempre tenha rótulo para cada linha/coluna.
 */
const gradesSchema = z
  .array(methodologyGradeSchema)
  .length(5, "São necessárias exatamente 5 gradações (níveis 1 a 5)")
  .superRefine((grades, ctx) => {
    grades.forEach((grade, index) => {
      if (grade.level !== index + 1) {
        ctx.addIssue({
          code: "custom",
          message: `As gradações devem estar em ordem 1..5 (posição ${index + 1} tem nível ${grade.level})`,
          path: [index, "level"],
        });
      }
    });
  });

/** Uma faixa de classificação: a classe cobre até `maxLevel` (limite superior). */
export const classificationBandSchema = z.object({
  classification: riskClassificationSchema,
  maxLevel: z.number().int().min(MIN_RISK_LEVEL).max(MAX_RISK_LEVEL),
});

export type ClassificationBand = z.infer<typeof classificationBandSchema>;

/**
 * As 5 faixas, guardadas como **limites superiores ordenados** — o que particiona
 * [1,25] de forma contígua e sem lacuna/sobreposição por construção (mata o edge
 * case "faixas que não cobrem 1–25"):
 * - exatamente 5 faixas, uma por classe, na ordem canônica (trivial→intolerable);
 * - `maxLevel` estritamente crescente;
 * - a última faixa (`intolerable`) fecha em `MAX_RISK_LEVEL` (25).
 */
const classificationBandsSchema = z
  .array(classificationBandSchema)
  .length(5, "São necessárias exatamente 5 faixas de classificação")
  .superRefine((bands, ctx) => {
    bands.forEach((band, index) => {
      if (band.classification !== RISK_CLASSIFICATION_ORDER[index]) {
        ctx.addIssue({
          code: "custom",
          message: `As faixas devem seguir a ordem ${RISK_CLASSIFICATION_ORDER.join(" → ")}`,
          path: [index, "classification"],
        });
      }
      if (index > 0 && band.maxLevel <= bands[index - 1].maxLevel) {
        ctx.addIssue({
          code: "custom",
          message: "Os limites das faixas devem ser estritamente crescentes",
          path: [index, "maxLevel"],
        });
      }
    });
    const last = bands[bands.length - 1];
    if (last && last.maxLevel !== MAX_RISK_LEVEL) {
      ctx.addIssue({
        code: "custom",
        message: `A última faixa deve fechar em ${MAX_RISK_LEVEL}`,
        path: [bands.length - 1, "maxLevel"],
      });
    }
  });

export const methodologyInputSchema = z.object({
  base: methodologyBaseSchema,
  probabilityGrades: gradesSchema,
  severityGrades: gradesSchema,
  classificationBands: classificationBandsSchema,
});

export type RiskMethodologyInput = z.input<typeof methodologyInputSchema>;
export type RiskMethodologyValues = z.output<typeof methodologyInputSchema>;

/**
 * DTO de leitura: a metodologia da organização **ou** o padrão derivado quando
 * nenhuma configuração foi salva (`configured: false`). A UI usa `configured`
 * para indicar "usando padrão".
 */
export type RiskMethodologyView = RiskMethodologyValues & { configured: boolean };

/**
 * Classifica um nível de risco (`prob × sev`, 1–25) segundo as faixas. Retorna a
 * primeira faixa cujo limite superior alcança o nível. `riskLevel` é limitado a
 * [1,25] por segurança. Função pura — coração testável da fatia.
 */
export function classify(
  riskLevel: number,
  bands: ClassificationBand[],
): RiskClassification {
  const level = Math.min(Math.max(Math.round(riskLevel), MIN_RISK_LEVEL), MAX_RISK_LEVEL);
  const band = bands.find((b) => level <= b.maxLevel);
  // Faixas validadas fecham em 25; o fallback cobre bandas eventualmente incompletas.
  return band?.classification ?? bands[bands.length - 1].classification;
}

export type MatrixCell = {
  probability: number;
  severity: number;
  level: number;
  classification: RiskClassification;
};

/**
 * Deriva as 25 células da matriz 5×5 aplicando `computeRiskLevel` (prob × sev) +
 * `classify`. A UI apenas renderiza o que esta função retorna.
 */
export function buildMatrix(bands: ClassificationBand[]): MatrixCell[] {
  const cells: MatrixCell[] = [];
  for (let probability = 1; probability <= 5; probability += 1) {
    for (let severity = 1; severity <= 5; severity += 1) {
      const level = computeRiskLevel(probability, severity);
      cells.push({
        probability,
        severity,
        level,
        classification: classify(level, bands),
      });
    }
  }
  return cells;
}

const CLASSIFICATION_LABELS: Record<RiskClassification, string> = {
  trivial: "Trivial",
  tolerable: "Tolerável",
  moderate: "Moderado",
  substantial: "Substancial",
  intolerable: "Intolerável",
};

export function riskClassificationLabel(value: RiskClassification): string {
  return CLASSIFICATION_LABELS[value];
}

const RISK_CLASSIFICATION_GUIDANCE: Record<RiskClassification, string> = {
  trivial: "Nenhuma ação obrigatória. Monitorar periodicamente.",
  tolerable: "Monitorar e reavaliar periodicamente. Plano de ação não obrigatório.",
  moderate: "Plano de ação obrigatório, com prazo e responsável definidos.",
  substantial: "Plano de ação prioritário, com prazo curto e responsável definidos.",
  intolerable: "Ação imediata. Interromper a atividade até a implementação do controle.",
};

export function riskClassificationGuidance(value: RiskClassification): string {
  return RISK_CLASSIFICATION_GUIDANCE[value];
}

const BASE_LABELS: Record<MethodologyBase, string> = {
  aiha: "AIHA",
  as_nzs_4360: "AS/NZS 4360",
  fundacentro: "Fundacentro",
  custom: "Personalizada",
};

export function methodologyBaseLabel(value: MethodologyBase): string {
  return BASE_LABELS[value];
}
