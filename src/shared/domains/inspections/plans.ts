import { z } from "zod";

import { optionalString, requiredString } from "@/shared/domains/pgr/form-fields";
import type { InspectionPlan, InspectionPlanItem } from "@/shared/db/schema";

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

export const planItemInputSchema = z.object({
  description: requiredString("Descrição do item é obrigatória"),
  defaultValue: z.coerce.boolean().default(false),
});
export type PlanItemInput = z.input<typeof planItemInputSchema>;

export const inspectionPlanInputSchema = z.object({
  type: planTypeSchema,
  subtype: optionalString,
  title: requiredString("Título é obrigatório"),
  description: optionalString,
  items: z.array(planItemInputSchema).default([]),
});
export type InspectionPlanInput = z.input<typeof inspectionPlanInputSchema>;
export type InspectionPlanValues = z.output<typeof inspectionPlanInputSchema>;

export type PlanListItem = {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  subtype: string | null;
  itemCount: number;
};

export function toPlanListItem(
  row: InspectionPlan & { itemCount: number },
): PlanListItem {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    typeLabel: planTypeLabel(row.type),
    subtype: row.subtype,
    itemCount: row.itemCount,
  };
}

export type PlanWithItems = {
  plan: InspectionPlan;
  items: InspectionPlanItem[];
};
