import {
  deriveMeasureState,
  controlLevelLabel,
  measureStateLabel,
  type ControlLevel,
  type MeasureState,
} from "./control-measure";
import { riskClassificationLabel, type RiskClassification } from "./risk-assessment";
import {
  riskAgentTypeLabel,
  type RiskAgentType,
  type PgrRegistrationType,
} from "./risks";

/**
 * Domínio da visão consolidada do PGR — issue #27. Estrutura **derivada** (não persistida)
 * que agrega PGR → GES vinculados → riscos → avaliação vigente → medidas de controle, com
 * **estado derivado** das medidas (Feature 018) e riscos ordenados por `risk_level` desc.
 * **Zero migration.** Reutilizável pela Fase 05 (PDF); a geração de PDF fica fora do escopo.
 */

export {
  deriveMeasureState,
  controlLevelLabel,
  measureStateLabel,
  riskClassificationLabel,
  riskAgentTypeLabel,
};
export type { ControlLevel, MeasureState, RiskClassification, RiskAgentType };

export type ConsolidatedMeasure = {
  id: string;
  controlLevel: ControlLevel;
  applicable: boolean;
  actionResponsible: string | null;
  actionDeadline: string | null;
  state: MeasureState; // deriveMeasureState (without_plan | planned | overdue)
};

export type ConsolidatedRisk = {
  id: string;
  agentType: RiskAgentType;
  description: string;
  riskLevel: number | null; // avaliação vigente (null = sem avaliação)
  result: RiskClassification | null; // classificação vigente
  measures: ConsolidatedMeasure[]; // [] = "Sem medidas de controle"
};

export type ConsolidatedGes = {
  id: string;
  name: string;
  risks: ConsolidatedRisk[]; // [] = "GES sem riscos"; ordenados por risk_level desc, sem avaliação por último
};

export type PgrConsolidated = {
  pgr: {
    id: string;
    companyName: string;
    workUnitName: string | null;
    responsible: string | null;
    registrationType: PgrRegistrationType;
    registrationNumber: string | null;
    issuedAt: string | null;
    validUntil: string | null;
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
