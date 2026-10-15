import {
  deriveMeasureState,
  controlLevelLabel,
  measureStateLabel,
  measureStatusLabel,
  type ControlLevel,
  type ControlMeasureStatus,
  type MeasureState,
} from "./control-measure";
import {
  deriveRiskPlanCoverage,
  planCoverageGuidance,
  planCoverageLabel,
  summarizePlanCoverage,
  RISK_PLAN_COVERAGES,
  type PlanCoverageSummary,
  type RiskPlanCoverage,
} from "./plan-coverage";
import { riskClassificationLabel, type RiskClassification } from "./risk-assessment";
import {
  riskAgentTypeLabel,
  exposureTimeLabel,
  measurementUnitLabel,
  assessmentCriterionLabel,
  type RiskAgentType,
  type PgrRegistrationType,
  type ExposureTime,
  type MeasurementUnit,
  type AssessmentCriterion,
} from "./risks";
import { epiNeutralizationLabel, type EpiNeutralization } from "./epi-risk";
import {
  hasNr09Measurement,
  isNr09EligibleAgent,
  nr09ConclusionLabel,
  formatMeasurement,
  type Nr09Conclusion,
} from "./nr09";
import {
  NO_ERGONOMIC_EVALUATION_LABEL,
  PSYCHOSOCIAL_AGGREGATE_LABEL,
  ergonomicAdequacyText,
  ergonomicDimensionLabel,
  formatCampaignPeriod,
  listErgonomicDimensions,
  type ErgonomicAdequacy,
  type ErgonomicDimension,
  type ErgonomicDimensionEntry,
  type PsychosocialAggregate,
} from "./ergonomics";

/**
 * Domínio da visão consolidada do PGR — issue #27 / fatia 022. Estrutura **derivada** (não
 * persistida) que agrega PGR → GES vinculados → riscos (com detalhe + campos eSocial S-2240) →
 * avaliação vigente (detalhada) → medidas de controle (5W2H completo, estado derivado da
 * Feature 018) → **EPIs por risco**, com riscos ordenados por `risk_level` desc.
 * **Zero migration.** Read-only; reutilizável pela Fase 05 (PDF), cuja geração fica fora do escopo.
 */

export {
  deriveMeasureState,
  controlLevelLabel,
  measureStateLabel,
  measureStatusLabel,
  deriveRiskPlanCoverage,
  planCoverageGuidance,
  planCoverageLabel,
  summarizePlanCoverage,
  RISK_PLAN_COVERAGES,
  riskClassificationLabel,
  riskAgentTypeLabel,
  exposureTimeLabel,
  measurementUnitLabel,
  assessmentCriterionLabel,
  epiNeutralizationLabel,
  hasNr09Measurement,
  isNr09EligibleAgent,
  nr09ConclusionLabel,
  formatMeasurement,
  NO_ERGONOMIC_EVALUATION_LABEL,
  PSYCHOSOCIAL_AGGREGATE_LABEL,
  ergonomicAdequacyText,
  ergonomicDimensionLabel,
  formatCampaignPeriod,
  listErgonomicDimensions,
};
export type {
  ErgonomicAdequacy,
  ErgonomicDimension,
  ErgonomicDimensionEntry,
  PsychosocialAggregate,
  ControlLevel,
  ControlMeasureStatus,
  MeasureState,
  PlanCoverageSummary,
  RiskPlanCoverage,
  RiskClassification,
  RiskAgentType,
  ExposureTime,
  MeasurementUnit,
  AssessmentCriterion,
  EpiNeutralization,
  Nr09Conclusion,
};

/**
 * EPI indicado para um risco. Os campos técnicos (#48) vêm do MESMO join com
 * `epi_catalog` — nenhuma query extra e nenhuma digitação paralela: a "especificação
 * técnica" do EPI é o conjunto de dados já cadastrados. Opcionais para não quebrar
 * fixtures anteriores à #48.
 */
export type ConsolidatedEpi = {
  id: string;
  catalogId: string;
  name: string;
  ca: string | null;
  neutralization: EpiNeutralization;
  description?: string | null;
  caValidUntil?: string | null;
  manufacturer?: string | null;
  norm?: string | null;
  material?: string | null;
  size?: string | null;
  unitOfMeasure?: string | null;
  usefulLifeMonths?: number | null;
};

/** Avaliação vigente detalhada (última por `assessed_at`/`created_at`). */
export type ConsolidatedAssessment = {
  criterion: AssessmentCriterion;
  probability: number;
  severity: number;
  riskLevel: number;
  uncertaintyDegree: number;
  toleranceLimit: string | null;
  result: RiskClassification | null;
  assessedAt: string;
  // Avaliação quantitativa NR-09 (#39) — `null` quando não houve medição. Ausência de
  // medição NÃO é conformidade: o PDF imprime "sem medição", nunca "abaixo do limite".
  evaluationMethod: string | null;
  measuredValue: string | null;
  measuredUnit: MeasurementUnit | null;
  toleranceLimitValue: string | null;
  nr09Conclusion: Nr09Conclusion | null;
};

/**
 * Avaliação ergonômica **vigente** do risco (NR-17, #40) — já achatada para leitura:
 * as seis dimensões vêm como lista ordenada com rótulo, estado e observação, e o bloco
 * psicossocial (quando há campanha vinculada) vem **agregado**. Nenhuma resposta
 * individual entra neste view model — não há por onde vazar para a tela nem para o PDF.
 */
export type ConsolidatedErgonomicEvaluation = {
  id: string;
  assessedAt: string;
  responsible: string | null;
  method: string | null;
  notes: string | null;
  dimensions: ErgonomicDimensionEntry[];
  psychosocial: PsychosocialAggregate | null;
};

export type ConsolidatedMeasure = {
  id: string;
  controlLevel: ControlLevel;
  applicable: boolean;
  // MANTER / INTRODUZIDA / APRIMORADA (#42); null = risco nunca avaliado quando a medida foi gravada.
  status: ControlMeasureStatus | null;
  justification: string | null;
  monitoring: string | null;
  // Plano 5W2H completo (todos já persistidos em `control_measures`; "onde" é derivado
  // do GES do risco na montagem do PDF — dado real de cadastro, nunca texto inventado).
  actionWhat: string | null;
  actionWhy: string | null;
  actionHow: string | null;
  actionTracking: string | null;
  actionMeasurement: string | null;
  actionResponsible: string | null;
  actionDeadline: string | null;
  actionCost: string | null;
  state: MeasureState; // deriveMeasureState (without_plan | planned | overdue)
};

export type ConsolidatedRisk = {
  id: string;
  agentType: RiskAgentType;
  description: string;
  hazard: string | null;
  sources: string | null; // fontes geradoras
  propagation: string | null;
  exposureTime: ExposureTime | null;
  possibleInjuries: string | null;
  // eSocial S-2240 (já persistidos — nada inventado).
  noxiousAgentCode: string | null;
  measurementUnit: MeasurementUnit | null;
  concentrationIntensity: string | null; // numeric → string no Drizzle
  // Avaliação vigente: `riskLevel`/`result` mantidos p/ compatibilidade + `assessment` detalhada.
  riskLevel: number | null; // null = sem avaliação
  result: RiskClassification | null;
  assessment: ConsolidatedAssessment | null;
  measures: ConsolidatedMeasure[]; // [] = "Sem medidas de controle"
  // Cobertura do plano do PGR (#42), derivada de `result` + `measures` — nunca persistida.
  planCoverage: RiskPlanCoverage;
  epis: ConsolidatedEpi[]; // [] = "Sem EPIs indicados"
  /**
   * Avaliação ergonômica vigente (#40). `null`/ausente = risco sem avaliação — o PDF
   * imprime "sem avaliação ergonômica registrada", nunca conformidade. Opcional para
   * não quebrar fixtures anteriores à #40.
   */
  ergonomic?: ConsolidatedErgonomicEvaluation | null;
};

export type ConsolidatedGes = {
  id: string;
  name: string;
  risks: ConsolidatedRisk[]; // [] = "GES sem riscos"; ordenados por risk_level desc, sem avaliação por último
};

/**
 * Identificação da empresa para a seção 1 do PDF (#47). Tudo já persistido em
 * `companies` — o consolidado só passou a ler. Campo vazio = "não informado".
 */
export type ConsolidatedCompany = {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  cnae: string | null;
  mainActivity: string | null;
  riskGrade: number | null;
  website: string | null;
  address: ConsolidatedAddress;
};

/** Endereço em partes; o template monta a linha. */
export type ConsolidatedAddress = {
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
};

/**
 * Unidade/obra da seção 1 (#47). `managerName`/`managerRole` são o **preposto** — é o
 * rótulo que o formulário de unidade usa ("Gestor/Preposto"), validado na auditoria do
 * Lote 2. Não existe campo separado e nenhum substituto é inventado.
 */
export type ConsolidatedWorkUnit = {
  name: string;
  type: string | null;
  contractNumber: string | null;
  managerName: string | null;
  managerRole: string | null;
  professionalTitle: string | null;
  professionalRegistration: string | null;
  startDate: string | null;
  expectedEndDate: string | null;
  address: ConsolidatedAddress;
};

export type PgrConsolidated = {
  pgr: {
    id: string;
    companyName: string;
    /** Site/portal da empresa (issue #5) — `null`/ausente = não exibe no PDF. */
    companyWebsite?: string | null;
    /** Nome do documento de ART anexado ao responsável técnico (issue #36) — `null` = não anexado, não exibe no PDF. */
    artDocumentName?: string | null;
    workUnitName: string | null;
    responsible: string | null;
    registrationType: PgrRegistrationType;
    registrationNumber: string | null;
    issuedAt: string | null;
    validUntil: string | null;
    /** Identificação completa (#47, seção 1) — opcional para não quebrar fixtures antigas. */
    company?: ConsolidatedCompany | null;
    workUnit?: ConsolidatedWorkUnit | null;
  };
  ges: ConsolidatedGes[]; // [] = "PGR sem GES"
};

/**
 * Ordena os riscos de um GES: **com** avaliação primeiro, por `riskLevel` desc (desempate
 * estável por descrição); riscos **sem** avaliação por último. Função pura (unit).
 */
export function sortConsolidatedRisks(risks: ConsolidatedRisk[]): ConsolidatedRisk[] {
  return [...risks].sort((a, b) => {
    const aHas = a.riskLevel != null;
    const bHas = b.riskLevel != null;
    if (aHas && bHas) {
      if (b.riskLevel! !== a.riskLevel!) return b.riskLevel! - a.riskLevel!;
      return a.description.localeCompare(b.description);
    }
    if (aHas) return -1;
    if (bHas) return 1;
    return a.description.localeCompare(b.description);
  });
}
