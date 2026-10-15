import { z } from "zod";

/**
 * Domínio puro do módulo de Riscos & PGR (paridade ePGR). Espelha os enums e
 * constraints do schema (`db/schema/risks.ts`, `db/schema/pgr.ts`) em Zod, mais
 * funções puras (matriz 5×5) e rótulos pt-BR. Sem acesso a banco — só regras.
 */

// ---------------------------------------------------------------------------
// Enums (espelham os pgEnum do schema)
// ---------------------------------------------------------------------------

export const riskAgentTypeSchema = z.enum([
  "physical",
  "chemical",
  "biological",
  "ergonomic",
  "mechanical",
  "accident",
  "psychosocial",
]);

export const exposureTimeSchema = z.enum([
  "lt_1h",
  "1_2h",
  "2_4h",
  "4_7h",
  "gt_7h",
  "eventual",
  "intermittent",
  "habitual",
]);

export const measurementUnitSchema = z.enum([
  "qualitative_na",
  "db_a",
  "db_c",
  "m_s2",
  "ppm",
  "mg_m3",
  "f_cm3",
  "celsius",
  "percent",
  "lux",
]);

export const assessmentCriterionSchema = z.enum(["qualitative", "quantitative"]);

export const controlLevelSchema = z.enum([
  "elimination",
  "collective_protection",
  "administrative",
  "ppe",
]);

export const pgrRegistrationTypeSchema = z.enum(["crm", "crea", "mte", "not_applicable"]);

export type RiskAgentType = z.infer<typeof riskAgentTypeSchema>;
export type ExposureTime = z.infer<typeof exposureTimeSchema>;
export type MeasurementUnit = z.infer<typeof measurementUnitSchema>;
export type AssessmentCriterion = z.infer<typeof assessmentCriterionSchema>;
export type ControlLevel = z.infer<typeof controlLevelSchema>;
export type PgrRegistrationType = z.infer<typeof pgrRegistrationTypeSchema>;

// ---------------------------------------------------------------------------
// Matriz 5×5 — probabilidade × severidade (espelha os CHECK do banco)
// ---------------------------------------------------------------------------

/** Probabilidade 1–5 (1 Rara … 5 Muito Provável). */
export const probabilitySchema = z.number().int().min(1).max(5);
/** Severidade 1–5 (1 Leve … 5 Mortes/incapacitantes múltiplas). */
export const severitySchema = z.number().int().min(1).max(5);
/** Grau de incerteza 0–2 (0 Certa / 1 Incerta / 2 Altamente Incerta). */
export const uncertaintyDegreeSchema = z.number().int().min(0).max(2);

/**
 * Nível de risco = probabilidade × severidade (1–25). Função pura espelhada pelo
 * CHECK de coerência `risk_level = probability * severity` no banco — a aplicação
 * calcula e persiste; o banco recusa valores incoerentes. Lança se as entradas
 * estiverem fora de 1–5.
 */
export function computeRiskLevel(probability: number, severity: number): number {
  probabilitySchema.parse(probability);
  severitySchema.parse(severity);
  return probability * severity;
}

// ---------------------------------------------------------------------------
// Rótulos pt-BR (enum em inglês no banco → UI em pt-BR)
// ---------------------------------------------------------------------------

const AGENT_TYPE_LABELS: Record<RiskAgentType, string> = {
  physical: "Físico",
  chemical: "Químico",
  biological: "Biológico",
  ergonomic: "Ergonômico",
  mechanical: "Mecânico",
  accident: "Acidentes",
  psychosocial: "Fatores psicossociais",
};

const EXPOSURE_TIME_LABELS: Record<ExposureTime, string> = {
  lt_1h: "< 1h/turno",
  "1_2h": "1 a 2h",
  "2_4h": "2 a 4h",
  "4_7h": "4 a 7h",
  gt_7h: "> 7h",
  eventual: "Eventual",
  intermittent: "Intermitente",
  habitual: "Habitual",
};

const MEASUREMENT_UNIT_LABELS: Record<MeasurementUnit, string> = {
  qualitative_na: "Qualitativo / Não aplicável",
  db_a: "dB(A)",
  db_c: "dB(C)",
  m_s2: "m/s²",
  ppm: "ppm",
  mg_m3: "mg/m³",
  f_cm3: "f/cm³",
  celsius: "°C",
  percent: "%",
  lux: "lux",
};

const MEASUREMENT_UNIT_ESOCIAL_LABELS: Record<MeasurementUnit, string> = {
  qualitative_na: "0 - Não aplicável",
  db_c: "3 - decibel (C) (dB(C))",
  db_a: "4 - decibel (A) (dB(A))",
  m_s2: "5 - metro por segundo ao quadrado (m/s²)",
  ppm: "7 - parte de vapor ou gás por milhão de partes de ar contaminado (ppm)",
  mg_m3: "8 - miligrama por metro cúbico de ar (mg/m³)",
  f_cm3: "9 - fibra por centímetro cúbico (f/cm³)",
  celsius: "10 - grau Celsius (°C)",
  percent: "12 - porcentual",
  lux: "13 - lux (lx)",
};

const CONTROL_LEVEL_LABELS: Record<ControlLevel, string> = {
  elimination: "I — Eliminação",
  collective_protection: "II — Proteção Coletiva",
  administrative: "III — Medidas Administrativas/Organização",
  ppe: "IV — EPI",
};

const CRITERION_LABELS: Record<AssessmentCriterion, string> = {
  qualitative: "Qualitativo",
  quantitative: "Quantitativo",
};

const UNCERTAINTY_LABELS: Record<number, string> = {
  0: "Certa",
  1: "Incerta",
  2: "Altamente Incerta",
};

const REGISTRATION_TYPE_LABELS: Record<PgrRegistrationType, string> = {
  crm: "CRM",
  crea: "CREA",
  mte: "MTE",
  not_applicable: "Não aplicável",
};

export function riskAgentTypeLabel(value: RiskAgentType): string {
  return AGENT_TYPE_LABELS[value];
}
export function exposureTimeLabel(value: ExposureTime): string {
  return EXPOSURE_TIME_LABELS[value];
}
export function measurementUnitLabel(value: MeasurementUnit): string {
  return MEASUREMENT_UNIT_LABELS[value];
}
export function measurementUnitEsocialLabel(value: MeasurementUnit): string {
  return MEASUREMENT_UNIT_ESOCIAL_LABELS[value];
}
export function controlLevelLabel(value: ControlLevel): string {
  return CONTROL_LEVEL_LABELS[value];
}
export function assessmentCriterionLabel(value: AssessmentCriterion): string {
  return CRITERION_LABELS[value];
}
export function uncertaintyDegreeLabel(value: number): string {
  return UNCERTAINTY_LABELS[value] ?? String(value);
}
export function pgrRegistrationTypeLabel(value: PgrRegistrationType): string {
  return REGISTRATION_TYPE_LABELS[value];
}
