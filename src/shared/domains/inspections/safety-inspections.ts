import { z } from "zod";

import { optionalString, requiredString } from "@/shared/domains/pgr/form-fields";
import type { Inspection, InspectionOccurrence } from "@/shared/db/schema";

import { inspectionNumber } from "./inspection-number";
import { inspectionStatusLabel } from "./vehicular-inspections";

export function safetyInspectionNumber(id: string): string {
  return inspectionNumber("IS", id);
}

/**
 * Resultado exibido na listagem. Diferente do `status` (andamento do trabalho),
 * o desfecho responde "a área está conforme?" e por isso deriva da contagem de
 * ocorrências abertas: inspeção ainda em andamento não tem desfecho, e a partir
 * de {@link CRITICAL_OCCURRENCE_THRESHOLD} ocorrências ela é crítica.
 */
export const CRITICAL_OCCURRENCE_THRESHOLD = 4;

export type SafetyInspectionOutcome =
  "in_progress" | "compliant" | "pending_items" | "critical";

export const SAFETY_OUTCOME_LABELS: Record<SafetyInspectionOutcome, string> = {
  in_progress: "Em andamento",
  compliant: "Conforme",
  pending_items: "Com pendências",
  critical: "Crítica",
};

export function classifySafetyInspection(input: {
  status: string;
  occurrenceCount: number;
}): SafetyInspectionOutcome {
  if (input.status === "in_progress") return "in_progress";
  if (input.occurrenceCount === 0) return "compliant";
  if (input.occurrenceCount >= CRITICAL_OCCURRENCE_THRESHOLD) return "critical";
  return "pending_items";
}

export const inspectionCategorySchema = z.enum([
  "safety",
  "environment",
  "quality",
  "health",
  "other",
]);
export type InspectionCategoryKey = z.infer<typeof inspectionCategorySchema>;

export const INSPECTION_CATEGORY_LABELS: Record<InspectionCategoryKey, string> = {
  safety: "Segurança",
  environment: "Meio ambiente",
  quality: "Qualidade",
  health: "Saúde",
  other: "Outros",
};

export function inspectionCategoryLabel(value: string | null): string {
  if (!value) return "—";
  return INSPECTION_CATEGORY_LABELS[value as InspectionCategoryKey] ?? value;
}

export const occurrenceSeveritySchema = z.enum(["low", "medium", "high"]);
export type OccurrenceSeverityKey = z.infer<typeof occurrenceSeveritySchema>;

export const OCCURRENCE_SEVERITY_LABELS: Record<OccurrenceSeverityKey, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export function occurrenceSeverityLabel(value: string | null): string {
  if (!value) return "—";
  return OCCURRENCE_SEVERITY_LABELS[value as OccurrenceSeverityKey] ?? value;
}

const uuid = z.string().uuid({ message: "Identificador inválido" });

// Cabeçalho da inspeção de segurança (livre — sem plano/checklist).
export const safetyInspectionHeaderSchema = z.object({
  category: inspectionCategorySchema,
  inspectedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida (YYYY-MM-DD)" }),
  planned: z.coerce.boolean().default(false),
  area: optionalString,
  companyId: uuid.nullable().optional(),
  responsible: optionalString,
  notes: optionalString,
});
export type SafetyInspectionHeaderInput = z.input<typeof safetyInspectionHeaderSchema>;
export type SafetyInspectionHeaderValues = z.output<typeof safetyInspectionHeaderSchema>;

// Ocorrência registrada na inspeção.
export const occurrenceInputSchema = z.object({
  description: requiredString("Descrição da ocorrência é obrigatória"),
  severity: occurrenceSeveritySchema.nullable().default(null),
});
export const occurrencesSchema = z.object({
  occurrences: z.array(occurrenceInputSchema).default([]),
});
export type OccurrencesInput = z.input<typeof occurrencesSchema>;
export type OccurrencesValues = z.output<typeof occurrencesSchema>;

export type SafetyInspectionListItem = {
  id: string;
  inspectedAt: string;
  status: string;
  statusLabel: string;
  category: string | null;
  categoryLabel: string;
  area: string | null;
  companyName: string | null;
  occurrenceCount: number;
};

export function toSafetyInspectionListItem(row: {
  id: string;
  inspectedAt: string;
  status: string;
  category: string | null;
  area: string | null;
  companyName: string | null;
  occurrenceCount: number;
}): SafetyInspectionListItem {
  return {
    id: row.id,
    inspectedAt: row.inspectedAt,
    status: row.status,
    statusLabel: inspectionStatusLabel(row.status),
    category: row.category,
    categoryLabel: inspectionCategoryLabel(row.category),
    area: row.area,
    companyName: row.companyName,
    occurrenceCount: row.occurrenceCount,
  };
}

export type SafetyInspectionDetail = {
  inspection: Inspection;
  company: { id: string; razaoSocial: string } | null;
  occurrences: InspectionOccurrence[];
};
