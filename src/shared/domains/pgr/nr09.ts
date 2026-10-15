import { z } from "zod";

import {
  measurementUnitLabel,
  riskAgentTypeLabel,
  type MeasurementUnit,
  type RiskAgentType,
} from "./risks";

/**
 * Domínio puro da avaliação quantitativa NR-09 (item 9.4.3) — issue #39. Só regras:
 * quem é elegível, como rotular e qual conclusão **sugerir**. A conclusão que vale é a
 * que o profissional confirma (decisão D-Q2 do Lote 2): aqui nada é decidido por conta
 * própria, e o backend nunca recalcula o que já foi escolhido.
 */

/**
 * Agentes contemplados pela NR-09: físicos, químicos e biológicos. Ergonômico,
 * mecânico, de acidentes e psicossocial ficam de fora — a norma não os cobre, e medir
 * um deles em ppm/dB(A) seria inventar semântica.
 */
export const NR09_ELIGIBLE_AGENTS = ["physical", "chemical", "biological"] as const;
export type Nr09EligibleAgent = (typeof NR09_ELIGIBLE_AGENTS)[number];

const ELIGIBLE = new Set<string>(NR09_ELIGIBLE_AGENTS);

export function isNr09EligibleAgent(agentType: RiskAgentType): boolean {
  return ELIGIBLE.has(agentType);
}

/** Texto pronto para explicar por que um risco não entra na seção NR-09. */
export function nr09IneligibleReason(agentType: RiskAgentType): string {
  return `Agente ${riskAgentTypeLabel(agentType).toLowerCase()} não é objeto da NR-09 (físicos, químicos e biológicos).`;
}

export const NR09_CONCLUSIONS = ["below_limit", "above_limit", "not_applicable"] as const;
export type Nr09Conclusion = (typeof NR09_CONCLUSIONS)[number];

export const nr09ConclusionSchema = z.enum(NR09_CONCLUSIONS, {
  error: "Conclusão inválida",
});

const CONCLUSION_LABELS: Record<Nr09Conclusion, string> = {
  below_limit: "Abaixo do limite de tolerância",
  above_limit: "Acima do limite de tolerância",
  not_applicable: "Limite não aplicável",
};

export function nr09ConclusionLabel(conclusion: Nr09Conclusion): string {
  return CONCLUSION_LABELS[conclusion];
}

/**
 * Métodos de avaliação sugeridos na UI (datalist). Lista **aberta**: a NR-09 não fixa
 * um conjunto fechado, e transformar isso em enum excluiria método legítimo.
 */
export const NR09_METHOD_SUGGESTIONS = [
  "NHO-01 (ruído)",
  "NHO-06 (calor)",
  "NHO-08 (aerodispersoides)",
  "NHO-09 (vibração)",
  "NHO-11 (aerodispersoides — fibras)",
  "NIOSH",
  "Dosimetria de jornada",
  "Amostragem pontual",
] as const;

export type Nr09Measurement = {
  measuredValue: string | number | null | undefined;
  measuredUnit: MeasurementUnit | null | undefined;
  toleranceLimitValue: string | number | null | undefined;
};

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Sugestão de conclusão a partir de valor medido × limite. **Auxílio, não veredito**:
 * devolve `null` quando falta um dos números (sem dado não se sugere nada) e trata
 * igualdade como "abaixo" apenas no sentido de "não excede" — é o que o técnico
 * confirma ou corrige. Unidade entra na comparação só para impedir comparar grandezas
 * diferentes; a conversão de unidades não é feita aqui de propósito.
 */
export function suggestNr09Conclusion(
  measurement: Nr09Measurement,
): Nr09Conclusion | null {
  const measured = toNumber(measurement.measuredValue);
  const limit = toNumber(measurement.toleranceLimitValue);
  if (measured === null || limit === null) return null;
  if (!measurement.measuredUnit || measurement.measuredUnit === "qualitative_na") {
    return null;
  }
  return measured > limit ? "above_limit" : "below_limit";
}

/** Rótulo "85 dB(A)" para valor + unidade; `null` quando não há valor. */
export function formatMeasurement(
  value: string | number | null | undefined,
  unit: MeasurementUnit | null | undefined,
): string | null {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  const text = String(value).trim();
  return unit && unit !== "qualitative_na"
    ? `${text} ${measurementUnitLabel(unit)}`
    : text;
}

/**
 * A avaliação tem conteúdo quantitativo NR-09? Usada pelo PDF e pela tela para separar
 * "medido" de "sem medição" — ausência de medição **nunca** vira conformidade.
 */
export function hasNr09Measurement(evaluation: {
  evaluationMethod?: string | null;
  measuredValue?: string | number | null;
  toleranceLimitValue?: string | number | null;
  nr09Conclusion?: Nr09Conclusion | null;
}): boolean {
  return Boolean(
    evaluation.evaluationMethod ||
    toNumber(evaluation.measuredValue) !== null ||
    toNumber(evaluation.toleranceLimitValue) !== null ||
    evaluation.nr09Conclusion,
  );
}
