import { z } from "zod";

import { optionalString, requiredString } from "@/shared/domains/pgr/form-fields";
import type { InspectionPlan, InspectionPlanItem } from "@/shared/db/schema";

import {
  inspectionFrequencySchema,
  INSPECTION_FREQUENCY_LABELS,
  inspectionFrequencyLabel,
} from "./vehicles";

// Planos são do tipo Veicular ou Máquinas e Equipamentos (segurança não usa plano).
export const planTypeSchema = z.enum(["vehicular", "equipment"]);
export type PlanTypeKey = z.infer<typeof planTypeSchema>;

export const PLAN_TYPE_LABELS: Record<PlanTypeKey, string> = {
  vehicular: "Veicular",
  equipment: "Máquinas e Equipamentos",
};

export function planTypeLabel(value: string): string {
  return PLAN_TYPE_LABELS[value as PlanTypeKey] ?? value;
}

// ── Status do plano ──────────────────────────────────────────────────────────
export const planStatusSchema = z.enum(["active", "draft", "inactive"]);
export type PlanStatus = z.infer<typeof planStatusSchema>;

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  active: "Ativo",
  draft: "Rascunho",
  inactive: "Inativo",
};

export function planStatusLabel(value: string | null): string {
  if (!value) return "—";
  return PLAN_STATUS_LABELS[value as PlanStatus] ?? value;
}

// ── Frequência (reusa o enum/ rótulos das inspeções veiculares) ───────────────
export { INSPECTION_FREQUENCY_LABELS, inspectionFrequencyLabel };

// ── Código sequencial por tenant ("PI-0014") ─────────────────────────────────
export function nextPlanNumber(currentMax: number | null | undefined): number {
  if (currentMax == null || !Number.isFinite(currentMax) || currentMax < 0) return 1;
  return Math.floor(currentMax) + 1;
}

export function formatPlanCode(n: number): string {
  return `PI-${String(n).padStart(4, "0")}`;
}

export const planItemInputSchema = z.object({
  description: requiredString("Descrição do item é obrigatória"),
  defaultValue: z.coerce.boolean().default(false),
});
export type PlanItemInput = z.input<typeof planItemInputSchema>;

const optionalFrequency = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  inspectionFrequencySchema.optional(),
);

export const inspectionPlanInputSchema = z.object({
  type: planTypeSchema,
  subtype: optionalString, // "Categoria" na UI (texto livre)
  title: requiredString("Título é obrigatório"),
  description: optionalString,
  frequency: optionalFrequency,
  status: planStatusSchema.optional(), // default "active" aplicado no repositório
  items: z.array(planItemInputSchema).default([]),
});
export type InspectionPlanInput = z.input<typeof inspectionPlanInputSchema>;
export type InspectionPlanValues = z.output<typeof inspectionPlanInputSchema>;

export type PlanListItem = {
  id: string;
  number: number;
  code: string;
  title: string;
  type: string;
  typeLabel: string;
  subtype: string | null;
  frequency: string | null;
  frequencyLabel: string;
  status: string;
  statusLabel: string;
  itemCount: number;
};

export function toPlanListItem(
  row: InspectionPlan & { itemCount: number },
): PlanListItem {
  return {
    id: row.id,
    number: row.number,
    code: formatPlanCode(row.number),
    title: row.title,
    type: row.type,
    typeLabel: planTypeLabel(row.type),
    subtype: row.subtype,
    frequency: row.frequency,
    frequencyLabel: inspectionFrequencyLabel(row.frequency),
    status: row.status,
    statusLabel: planStatusLabel(row.status),
    itemCount: row.itemCount,
  };
}

export type PlanWithItems = {
  plan: InspectionPlan;
  items: InspectionPlanItem[];
};
