import { z } from "zod";

import { optionalString } from "@/shared/domains/pgr/form-fields";
import type { Inspection } from "@/shared/db/schema";

import { inspectionStatusLabel, type ChecklistRow } from "./vehicular-inspections";

const uuid = z.string().uuid({ message: "Identificador inválido" });

// Cabeçalho da inspeção de equipamento (equipamento do catálogo + plano).
// Sem campos veiculares (motorista/rota/quilometragem).
export const equipmentInspectionHeaderSchema = z.object({
  equipmentCatalogId: uuid,
  planId: uuid,
  inspectedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida (YYYY-MM-DD)" }),
  responsible: optionalString,
  notes: optionalString,
});
export type EquipmentInspectionHeaderInput = z.input<
  typeof equipmentInspectionHeaderSchema
>;
export type EquipmentInspectionHeaderValues = z.output<
  typeof equipmentInspectionHeaderSchema
>;

// Checklist (tri-state) é compartilhado com a inspeção veicular.
export {
  checklistSchema,
  itemResponseSchema,
  type ChecklistInput,
  type ChecklistValues,
  type ChecklistRow,
} from "./vehicular-inspections";

export type EquipmentInspectionListItem = {
  id: string;
  inspectedAt: string;
  status: string;
  statusLabel: string;
  equipmentName: string | null;
  planTitle: string | null;
  responsible: string | null;
};

export function toEquipmentInspectionListItem(row: {
  id: string;
  inspectedAt: string;
  status: string;
  equipmentName: string | null;
  planTitle: string | null;
  responsible: string | null;
}): EquipmentInspectionListItem {
  return {
    id: row.id,
    inspectedAt: row.inspectedAt,
    status: row.status,
    statusLabel: inspectionStatusLabel(row.status),
    equipmentName: row.equipmentName,
    planTitle: row.planTitle,
    responsible: row.responsible,
  };
}

export type EquipmentInspectionDetail = {
  inspection: Inspection;
  equipment: { id: string; name: string } | null;
  plan: { id: string; title: string } | null;
  items: ChecklistRow[];
};
