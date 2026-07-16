import { z } from "zod";

import {
  optionalIsoDate,
  optionalString,
  requiredString,
} from "@/shared/domains/pgr/form-fields";
import type { ScheduleEvent } from "@/shared/db/schema";

export const scheduleEventTypeSchema = z.enum([
  "inspection",
  "training",
  "exam",
  "document_expiry",
  "other",
]);
export type ScheduleEventType = z.infer<typeof scheduleEventTypeSchema>;

export const SCHEDULE_EVENT_TYPE_LABELS: Record<ScheduleEventType, string> = {
  inspection: "Inspeção",
  training: "Treinamento",
  exam: "Exame médico",
  document_expiry: "Vencimento de documento",
  other: "Outro",
};

export function scheduleEventTypeLabel(value: string): string {
  return SCHEDULE_EVENT_TYPE_LABELS[value as ScheduleEventType] ?? value;
}

export const scheduleEventInputSchema = z.object({
  eventType: scheduleEventTypeSchema,
  title: requiredString("Título é obrigatório"),
  eventDate: z.iso.date("Data inválida (use AAAA-MM-DD)"),
  description: optionalString,
  referenceUrl: optionalString,
});
export type ScheduleEventInput = z.input<typeof scheduleEventInputSchema>;
export type ScheduleEventValues = z.output<typeof scheduleEventInputSchema>;

// Filtros da listagem (opcionais): tipo + janela de datas.
export const scheduleListFilterSchema = z.object({
  eventType: scheduleEventTypeSchema.optional(),
  from: optionalIsoDate,
  to: optionalIsoDate,
});

export type ScheduleEventListItem = {
  id: string;
  eventType: string;
  eventTypeLabel: string;
  title: string;
  eventDate: string;
  description: string | null;
  referenceUrl: string | null;
};

export function toScheduleEventListItem(row: ScheduleEvent): ScheduleEventListItem {
  return {
    id: row.id,
    eventType: row.eventType,
    eventTypeLabel: scheduleEventTypeLabel(row.eventType),
    title: row.title,
    eventDate: row.eventDate,
    description: row.description,
    referenceUrl: row.referenceUrl,
  };
}
