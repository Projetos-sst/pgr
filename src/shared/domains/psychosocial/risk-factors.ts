import { z } from "zod";

import type {
  PsychosocialRiskFactor,
  PsychosocialRiskLevelValue,
  PsychosocialFactorStatusValue,
} from "@/shared/db/schema/psychosocial";

import { optionalString, requiredString, requiredUuid } from "../pgr/form-fields";

export type { PsychosocialRiskFactor };

/** Tom da pílula de status do kit de listagem (espelha `_ui/data-list`). */
export type FactorTone = "green" | "amber" | "red" | "neutral" | "indigo";

// ── Nível do fator ──────────────────────────────────────────────────────────
export const PSYCHOSOCIAL_RISK_LEVELS = ["low", "medium", "high"] as const;

export const psychosocialRiskLevelSchema = z.enum(PSYCHOSOCIAL_RISK_LEVELS, {
  error: "Nível inválido",
});

export type PsychosocialRiskLevel = (typeof PSYCHOSOCIAL_RISK_LEVELS)[number];

const LEVEL_LABELS: Record<PsychosocialRiskLevel, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
};

export function psychosocialRiskLevelLabel(level: string): string {
  return LEVEL_LABELS[level as PsychosocialRiskLevel] ?? level;
}

/** Tom da pílula do nível (verde/âmbar/vermelho — espelha o mockup). */
export function psychosocialRiskLevelTone(level: string): FactorTone {
  if (level === "high") return "red";
  if (level === "medium") return "amber";
  return "green";
}

// ── Situação do tratamento ──────────────────────────────────────────────────
export const PSYCHOSOCIAL_FACTOR_STATUSES = [
  "in_action",
  "monitored",
  "controlled",
] as const;

export const psychosocialFactorStatusSchema = z.enum(PSYCHOSOCIAL_FACTOR_STATUSES, {
  error: "Situação inválida",
});

export type PsychosocialFactorStatus = (typeof PSYCHOSOCIAL_FACTOR_STATUSES)[number];

const STATUS_LABELS: Record<PsychosocialFactorStatus, string> = {
  in_action: "Em ação",
  monitored: "Monitorado",
  controlled: "Controlado",
};

export function psychosocialFactorStatusLabel(status: string): string {
  return STATUS_LABELS[status as PsychosocialFactorStatus] ?? status;
}

/** Tom da pílula da situação (indigo p/ ação/monitorado; neutro p/ controlado). */
export function psychosocialFactorStatusTone(status: string): FactorTone {
  if (status === "controlled") return "neutral";
  return "indigo";
}

// ── Código sequencial ("PS-07") ─────────────────────────────────────────────
export function nextPsychosocialFactorNumber(
  currentMax: number | null | undefined,
): number {
  if (currentMax == null || !Number.isFinite(currentMax) || currentMax < 0) return 1;
  return Math.floor(currentMax) + 1;
}

export function formatPsychosocialFactorCode(n: number): string {
  return `PS-${String(n).padStart(2, "0")}`;
}

// ── Schema de entrada ───────────────────────────────────────────────────────
export const psychosocialRiskFactorInputSchema = z.object({
  name: requiredString("Fator de risco é obrigatório"),
  gesId: requiredUuid("GES é obrigatório"),
  level: psychosocialRiskLevelSchema,
  assessmentMethod: optionalString,
  status: psychosocialFactorStatusSchema.default("monitored"),
  description: optionalString,
});

export type PsychosocialRiskFactorInput = z.input<
  typeof psychosocialRiskFactorInputSchema
>;
export type PsychosocialRiskFactorValues = z.output<
  typeof psychosocialRiskFactorInputSchema
>;

/** Linha da listagem — fator + nome do GES (derivado por JOIN). */
export type PsychosocialRiskFactorRow = PsychosocialRiskFactor & {
  gesName: string | null;
};

export type { PsychosocialRiskLevelValue, PsychosocialFactorStatusValue };
