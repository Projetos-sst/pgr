import {
  isMeasureMissingRequiredPlanFields,
  type ControlMeasureStatus,
} from "./control-measure";
import type { RiskClassification } from "./methodology";

/**
 * Cobertura do plano do PGR por risco (#42). O "plano de ação" do PGR é feito das medidas de
 * controle (`control_measures`), não do módulo `action_plans`. Todo risco do inventário aparece no
 * plano com uma cobertura **derivada na leitura** — nada é persistido nem criado automaticamente
 * (nenhuma medida ou plano com conteúdo inventado).
 *
 * Reclassificação não escreve nada: se o risco sobe para moderado+, medidas aplicáveis sem
 * responsável/prazo tornam o risco `incomplete` até alguém revisá-las; se desce, os dados humanos
 * ficam como estão e a cobertura simplesmente deixa de exigir esses campos.
 */

export const RISK_PLAN_COVERAGES = [
  "not_assessed",
  "no_measure",
  "incomplete",
  "covered",
] as const;
export type RiskPlanCoverage = (typeof RISK_PLAN_COVERAGES)[number];

const COVERAGE_LABELS: Record<RiskPlanCoverage, string> = {
  not_assessed: "Não avaliado",
  no_measure: "Sem medida",
  incomplete: "Incompleto",
  covered: "Coberto",
};

const COVERAGE_GUIDANCE: Record<RiskPlanCoverage, string> = {
  not_assessed: "Avalie o risco para definir o nível e o que o plano exige.",
  no_measure:
    "Cadastre ao menos uma medida de controle — medidas já existentes entram com status Manter.",
  incomplete:
    "Risco moderado ou superior: informe responsável e prazo nas medidas aplicáveis.",
  covered: "Plano de ação definido para este risco.",
};

export function planCoverageLabel(coverage: RiskPlanCoverage): string {
  return COVERAGE_LABELS[coverage];
}

export function planCoverageGuidance(coverage: RiskPlanCoverage): string {
  return COVERAGE_GUIDANCE[coverage];
}

export type PlanCoverageMeasure = {
  applicable: boolean;
  status?: ControlMeasureStatus | null;
  actionResponsible: string | null;
  actionDeadline: string | null;
};

/**
 * Precedência: sem classificação vigente → `not_assessed`; sem medidas → `no_measure`; alguma
 * medida faltando os campos obrigatórios do nível → `incomplete`; senão `covered`. Risco moderado+
 * só com medidas não aplicáveis é `covered`, espelhando a regra de escrita do repositório (que
 * também só exige responsável/prazo de medida aplicável).
 */
export function deriveRiskPlanCoverage(risk: {
  result: RiskClassification | null;
  measures: PlanCoverageMeasure[];
}): RiskPlanCoverage {
  if (risk.result === null) return "not_assessed";
  if (risk.measures.length === 0) return "no_measure";
  if (risk.measures.some((m) => isMeasureMissingRequiredPlanFields(m, risk.result))) {
    return "incomplete";
  }
  return "covered";
}

export type PlanCoverageSummary = Record<RiskPlanCoverage, number>;

/** Contagem por cobertura (zero-fill em todas as chaves). */
export function summarizePlanCoverage(
  risks: { planCoverage: RiskPlanCoverage }[],
): PlanCoverageSummary {
  const summary: PlanCoverageSummary = {
    not_assessed: 0,
    no_measure: 0,
    incomplete: 0,
    covered: 0,
  };
  for (const risk of risks) summary[risk.planCoverage] += 1;
  return summary;
}
