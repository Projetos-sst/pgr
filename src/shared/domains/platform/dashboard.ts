import {
  controlLevelLabel,
  controlLevelSchema,
  riskAgentTypeLabel,
  riskAgentTypeSchema,
} from "@/shared/domains/pgr/risks";

export const RISK_AGENT_TYPES = riskAgentTypeSchema.options;
export const CONTROL_LEVELS = controlLevelSchema.options;

export type CountByKey = { key: string; label: string; count: number };

export type DashboardKpis = {
  companies: number;
  employees: number;
  workUnits: number;
  ges: number;
  risks: number;
  pgrs: number;
};

export type DashboardPending = {
  pgrsExpired: number;
  controlsOverdue: number;
  episLowStock: number;
  episPendingReturn: number;
  trainingsExpired: number;
  trainingsDueSoon: number;
};

export type ServiceOrdersSummary = {
  signed: number;
  pending: number;
  refused: number;
  total: number;
};

export type AccidentsSummary = {
  open: number;
  inAnalysis: number;
  resolved: number;
  archived: number;
  total: number;
};

export type DashboardSummary = {
  kpis: DashboardKpis;
  risksByAgentType: CountByKey[];
  actionPlansByLevel: CountByKey[];
  pending: DashboardPending;
  serviceOrdersSummary?: ServiceOrdersSummary;
  accidentsSummary?: AccidentsSummary;
};

/**
 * Zero-fill: garante uma linha por chave conhecida (na ordem do enum), mesmo
 * quando a agregação não retornou aquele grupo. Puro — testável isoladamente.
 */
export function zeroFillCounts<T extends string>(
  keys: readonly T[],
  labelFn: (key: T) => string,
  rows: { key: string; count: number }[],
): CountByKey[] {
  const byKey = new Map(rows.map((r) => [r.key, r.count]));
  return keys.map((key) => ({ key, label: labelFn(key), count: byKey.get(key) ?? 0 }));
}

export function fillRisksByAgentType(
  rows: { key: string; count: number }[],
): CountByKey[] {
  return zeroFillCounts(RISK_AGENT_TYPES, riskAgentTypeLabel, rows);
}

export function fillActionPlansByLevel(
  rows: { key: string; count: number }[],
): CountByKey[] {
  return zeroFillCounts(CONTROL_LEVELS, controlLevelLabel, rows);
}

export type BarSegment = CountByKey & { percent: number };

/**
 * Percentual de cada barra relativo ao maior valor da série (para gráfico de
 * barras CSS). Série toda zerada → todos 0%. Puro/testável.
 */
export function withBarPercents(rows: CountByKey[]): BarSegment[] {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
  return rows.map((r) => ({
    ...r,
    percent: max === 0 ? 0 : Math.round((r.count / max) * 100),
  }));
}
