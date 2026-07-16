import { z } from "zod";

import type {
  EsocialEvent,
  EsocialEventStatus,
  EsocialEventType,
} from "@/shared/db/schema";

export const EVENT_TYPES: EsocialEventType[] = [
  "S-2190",
  "S-2200",
  "S-2210",
  "S-2220",
  "S-2221",
  "S-2240",
  "S-2300",
];

export const EVENT_TYPE_LABELS: Record<EsocialEventType, string> = {
  "S-2190": "S-2190 · Registro Preliminar de Admissão",
  "S-2200": "S-2200 · Admissão / Cadastramento Inicial",
  "S-2210": "S-2210 · Comunicação de Acidente (CAT)",
  "S-2220": "S-2220 · Monitoramento da Saúde (ASO)",
  "S-2221": "S-2221 · Exame Toxicológico",
  "S-2240": "S-2240 · Condições Ambientais (Agentes Nocivos)",
  "S-2300": "S-2300 · Trabalhador Sem Vínculo",
};

export function eventTypeLabel(value: string): string {
  return EVENT_TYPE_LABELS[value as EsocialEventType] ?? value;
}

export const EVENT_STATUS_LABELS: Record<EsocialEventStatus, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  sent: "Enviado",
  accepted: "Aceito",
  rejected: "Rejeitado",
  error: "Erro",
};

export function eventStatusLabel(value: string): string {
  return EVENT_STATUS_LABELS[value as EsocialEventStatus] ?? value;
}

export const eventTypeSchema = z.enum([
  "S-2190",
  "S-2200",
  "S-2210",
  "S-2220",
  "S-2221",
  "S-2240",
  "S-2300",
]);

// Filtros da listagem (Data Inicial/Final/Status).
export const listFiltersSchema = z.object({
  status: z
    .enum(["draft", "pending", "sent", "accepted", "rejected", "error"])
    .optional(),
  eventType: eventTypeSchema.optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type ListFilters = z.infer<typeof listFiltersSchema>;

// Transições de status permitidas (não volta de accepted/rejected para draft).
const EVENT_STATUS_TRANSITIONS: Record<EsocialEventStatus, EsocialEventStatus[]> = {
  draft: ["pending"],
  pending: ["sent"],
  sent: ["accepted", "rejected", "error"],
  accepted: [],
  rejected: ["pending"],
  error: ["pending"],
};

export function canTransitionEventStatus(
  from: EsocialEventStatus,
  to: EsocialEventStatus,
): boolean {
  if (from === to) return true;
  return EVENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// Só eventos `pending` podem ser enviados em lote.
export function canSendEvent(status: EsocialEventStatus): boolean {
  return status === "pending";
}

export type EventListItem = {
  id: string;
  eventType: string;
  eventTypeLabel: string;
  status: string;
  statusLabel: string;
  referenceId: string | null;
  batchId: string | null;
  createdAt: string;
};

export function toEventListItem(row: {
  id: string;
  eventType: string;
  status: string;
  referenceId: string | null;
  batchId: string | null;
  createdAt: Date | string;
}): EventListItem {
  return {
    id: row.id,
    eventType: row.eventType,
    eventTypeLabel: eventTypeLabel(row.eventType),
    status: row.status,
    statusLabel: eventStatusLabel(row.status),
    referenceId: row.referenceId,
    batchId: row.batchId,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

export type EsocialEventDetail = EsocialEvent;
