import { z } from "zod";

import { requiredUuid } from "./form-fields";

/**
 * Vínculo EPI × risco com a indicação de neutralização (fatia epi-risk-link).
 *
 * A neutralização é um enum de **3 estados** (o card exige "Sim / Não / Não
 * Aplicável"). "Não Aplicável" (`not_applicable`) cobre um EPI que é listado no
 * risco mas cuja neutralização não se aplica (ex.: risco ergonômico controlado
 * por medida administrativa) — distinto de "risco sem EPI" (nenhum vínculo).
 */
export const EPI_NEUTRALIZATION_ORDER = [
  "neutralizes",
  "does_not_neutralize",
  "not_applicable",
] as const;

export const epiNeutralizationSchema = z.enum(EPI_NEUTRALIZATION_ORDER, {
  error: "Indicação de neutralização é obrigatória",
});

export type EpiNeutralization = z.infer<typeof epiNeutralizationSchema>;

const NEUTRALIZATION_LABELS: Record<EpiNeutralization, string> = {
  neutralizes: "Sim",
  does_not_neutralize: "Não",
  not_applicable: "Não Aplicável",
};

export function epiNeutralizationLabel(value: EpiNeutralization): string {
  return NEUTRALIZATION_LABELS[value];
}

/** Corpo de criação do vínculo: qual EPI, para qual risco, com qual indicação. */
export const epiRiskLinkInputSchema = z.object({
  riskId: requiredUuid("Risco é obrigatório"),
  catalogId: requiredUuid("EPI é obrigatório"),
  neutralization: epiNeutralizationSchema,
});

export type EpiRiskLinkInput = z.input<typeof epiRiskLinkInputSchema>;
export type EpiRiskLinkValues = z.output<typeof epiRiskLinkInputSchema>;

/** Atualização: só a indicação de neutralização de um vínculo existente. */
export const epiRiskLinkUpdateSchema = z.object({
  neutralization: epiNeutralizationSchema,
});

export type EpiRiskLinkUpdateInput = z.input<typeof epiRiskLinkUpdateSchema>;
export type EpiRiskLinkUpdateValues = z.output<typeof epiRiskLinkUpdateSchema>;

/** Linha da tabela de EPIs vinculados a um risco (Nome · CA · Neutraliza?). */
export type EpiRiskLinkItem = {
  id: string;
  catalogId: string;
  name: string;
  ca: string | null;
  neutralization: EpiNeutralization;
};

/** EPI do catálogo elegível para vínculo (picker de busca por nome/CA). */
export type EpiOption = {
  catalogId: string;
  name: string;
  ca: string | null;
};
