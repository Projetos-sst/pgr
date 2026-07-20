import { z } from "zod";

import { optionalString, requiredString } from "@/shared/domains/pgr/form-fields";
import type { WorkPermit } from "@/shared/db/schema";

export const workPermitTypeSchema = z.enum([
  "hot_work",
  "confined_space",
  "height",
  "electrical",
  "excavation",
  "cold_work",
  "other",
]);
export type WorkPermitTypeKey = z.infer<typeof workPermitTypeSchema>;

export const WORK_PERMIT_TYPE_LABELS: Record<WorkPermitTypeKey, string> = {
  hot_work: "Trabalho a quente",
  confined_space: "Espaço confinado",
  height: "Trabalho em altura",
  electrical: "Serviços elétricos",
  excavation: "Escavação",
  cold_work: "Trabalho a frio",
  other: "Outros",
};

export function workPermitTypeLabel(value: string): string {
  return WORK_PERMIT_TYPE_LABELS[value as WorkPermitTypeKey] ?? value;
}

export const workPermitStatusSchema = z.enum([
  "draft",
  "active",
  "suspended",
  "closed",
  "cancelled",
]);
export type WorkPermitStatusKey = z.infer<typeof workPermitStatusSchema>;

export const WORK_PERMIT_STATUS_LABELS: Record<WorkPermitStatusKey, string> = {
  draft: "Rascunho",
  active: "Ativa",
  suspended: "Suspensa",
  closed: "Encerrada",
  cancelled: "Cancelada",
};

export function workPermitStatusLabel(value: string): string {
  return WORK_PERMIT_STATUS_LABELS[value as WorkPermitStatusKey] ?? value;
}

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida (YYYY-MM-DD)" });

export const workPermitInputSchema = z
  .object({
    number: requiredString("Número da PT é obrigatório"),
    type: workPermitTypeSchema,
    status: workPermitStatusSchema.default("draft"),
    companyId: z.string().uuid({ message: "Empresa inválida" }).nullable().optional(),
    area: optionalString,
    description: requiredString("Descrição do trabalho é obrigatória"),
    validFrom: dateString,
    validUntil: dateString,
    requestedBy: optionalString,
    approvedBy: optionalString,
    precautions: optionalString,
    notes: optionalString,
  })
  .refine((v) => v.validUntil >= v.validFrom, {
    message: "A validade final deve ser igual ou posterior à inicial.",
    path: ["validUntil"],
  });
export type WorkPermitInput = z.input<typeof workPermitInputSchema>;
export type WorkPermitValues = z.output<typeof workPermitInputSchema>;

export type WorkPermitListItem = {
  id: string;
  number: string;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  companyName: string | null;
  validFrom: string;
  validUntil: string;
};

export function toWorkPermitListItem(row: {
  id: string;
  number: string;
  type: string;
  status: string;
  companyName: string | null;
  validFrom: string;
  validUntil: string;
}): WorkPermitListItem {
  return {
    id: row.id,
    number: row.number,
    type: row.type,
    typeLabel: workPermitTypeLabel(row.type),
    status: row.status,
    statusLabel: workPermitStatusLabel(row.status),
    companyName: row.companyName,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
  };
}

export type WorkPermitDetail = {
  permit: WorkPermit;
  company: { id: string; razaoSocial: string } | null;
};
