import { z } from "zod";

import { optionalString } from "@/shared/domains/pgr/form-fields";
import type { Inspection, InspectionStatus } from "@/shared/db/schema";

const uuid = z.string().uuid({ message: "Identificador inválido" });

// Passo 1 — cabeçalho da inspeção veicular (veículo + plano + dados de rota).
export const vehicularInspectionHeaderSchema = z.object({
  vehicleId: uuid,
  planId: uuid,
  inspectedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida (YYYY-MM-DD)" }),
  responsible: optionalString,
  driverName: optionalString,
  driverLicense: optionalString,
  currentKm: z.coerce
    .number()
    .int({ message: "Quilometragem deve ser inteira" })
    .min(0, { message: "Quilometragem não pode ser negativa" })
    .optional(),
  route: optionalString,
  notes: optionalString,
});
export type VehicularInspectionHeaderInput = z.input<
  typeof vehicularInspectionHeaderSchema
>;
export type VehicularInspectionHeaderValues = z.output<
  typeof vehicularInspectionHeaderSchema
>;

// Passo 2 — checklist: uma resposta por item do plano.
// value: true = conforme, false = não conforme, null = não se aplica.
export const itemResponseSchema = z.object({
  planItemId: uuid,
  value: z.boolean().nullable(),
  observation: optionalString,
});
export const checklistSchema = z.object({
  responses: z.array(itemResponseSchema).default([]),
});
export type ChecklistInput = z.input<typeof checklistSchema>;
export type ChecklistValues = z.output<typeof checklistSchema>;

export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export function inspectionStatusLabel(value: string): string {
  return INSPECTION_STATUS_LABELS[value as InspectionStatus] ?? value;
}

/**
 * Identificador curto e estável exibido na listagem. `inspections` não tem
 * número sequencial, então o rótulo é derivado do uuid — 6 dígitos hex (~16,7
 * milhões de combinações) mantêm o formato compacto do design sem que dois
 * registros apareçam com o mesmo "Nº" numa base realista. Só para leitura
 * humana: links e chamadas continuam usando o uuid completo.
 */
export function vehicularInspectionNumber(id: string): string {
  return `IV-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export type VehicularInspectionListItem = {
  id: string;
  inspectedAt: string;
  status: string;
  statusLabel: string;
  vehiclePlate: string | null;
  planTitle: string | null;
  responsible: string | null;
};

export function toVehicularInspectionListItem(row: {
  id: string;
  inspectedAt: string;
  status: string;
  vehiclePlate: string | null;
  planTitle: string | null;
  responsible: string | null;
}): VehicularInspectionListItem {
  return {
    id: row.id,
    inspectedAt: row.inspectedAt,
    status: row.status,
    statusLabel: inspectionStatusLabel(row.status),
    vehiclePlate: row.vehiclePlate,
    planTitle: row.planTitle,
    responsible: row.responsible,
  };
}

export type ChecklistRow = {
  planItemId: string;
  description: string;
  defaultValue: boolean;
  value: boolean | null;
  observation: string | null;
};

export type VehicularInspectionDetail = {
  inspection: Inspection;
  vehicle: { id: string; plate: string } | null;
  plan: { id: string; title: string } | null;
  items: ChecklistRow[];
};
