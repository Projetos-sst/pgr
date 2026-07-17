import { z } from "zod";

import { optionalIsoDate, optionalUuid } from "@/shared/domains/pgr/form-fields";
import type { ServiceOrder, ServiceOrderItem } from "@/shared/db/schema";

import { computeDaysOpen } from "./service-order-number";

// ── Status ────────────────────────────────────────────────────────────────────

export const serviceOrderStatusSchema = z.enum([
  "open",
  "in_progress",
  "completed",
  "cancelled",
]);
export type ServiceOrderStatus = z.infer<typeof serviceOrderStatusSchema>;

export const SERVICE_ORDER_STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  open: "Aberta",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export function serviceOrderStatusLabel(value: string | null): string {
  if (!value) return "—";
  return SERVICE_ORDER_STATUS_LABELS[value as ServiceOrderStatus] ?? value;
}

/** Estados em que a OS ainda pode ser editada/excluída (não terminais). */
export const SERVICE_ORDER_EDITABLE_STATES: ReadonlySet<ServiceOrderStatus> = new Set([
  "open",
  "in_progress",
]);

export function isServiceOrderEditable(status: string): boolean {
  return SERVICE_ORDER_EDITABLE_STATES.has(status as ServiceOrderStatus);
}

export function isServiceOrderTerminal(status: string): boolean {
  return status === "completed" || status === "cancelled";
}

/**
 * Transições permitidas do estado da OS (FR-014): terminais não retrocedem.
 * A imutabilidade adicional "OS assinada" é aplicada no Bloco C (assinatura).
 */
const STATUS_TRANSITIONS: Record<ServiceOrderStatus, ReadonlySet<ServiceOrderStatus>> = {
  open: new Set(["in_progress", "completed", "cancelled"]),
  in_progress: new Set(["completed", "cancelled"]),
  completed: new Set(),
  cancelled: new Set(),
};

export function canTransitionServiceOrder(
  from: ServiceOrderStatus,
  to: ServiceOrderStatus,
): boolean {
  if (from === to) return true;
  return STATUS_TRANSITIONS[from].has(to);
}

// ── Itens ─────────────────────────────────────────────────────────────────────

export const serviceOrderItemSourceSchema = z.enum(["manual", "risk", "epi"]);
export type ServiceOrderItemSource = z.infer<typeof serviceOrderItemSourceSchema>;

export const MAX_ITEM_DESCRIPTION = 500;
export const MAX_ITEMS_PER_ORDER = 100;

/**
 * Item do checklist da OS. Snapshot textual regulatório: o cliente informa
 * `description` (≤500) e, para itens sugeridos, `source_type`/`source_id`. `number`
 * e `org_id` nunca vêm do cliente; `sort_order` é determinístico no servidor.
 */
export const serviceOrderItemInputSchema = z
  .object({
    description: z
      .string({ error: "Descrição do item é obrigatória" })
      .trim()
      .min(1, "Descrição do item é obrigatória")
      .max(MAX_ITEM_DESCRIPTION, `Descrição deve ter no máximo ${MAX_ITEM_DESCRIPTION} caracteres`),
    sourceType: serviceOrderItemSourceSchema.default("manual"),
    sourceId: optionalUuid.nullable().optional(),
    done: z.coerce.boolean().default(false),
  })
  .strict();
export type ServiceOrderItemInput = z.input<typeof serviceOrderItemInputSchema>;
export type ServiceOrderItemValues = z.output<typeof serviceOrderItemInputSchema>;

const itemsField = z
  .array(serviceOrderItemInputSchema)
  .max(MAX_ITEMS_PER_ORDER, `No máximo ${MAX_ITEMS_PER_ORDER} itens por OS`)
  .default([]);

// ── OS (create/update) ──────────────────────────────────────────────────────

const titleField = z
  .string({ error: "Título é obrigatório" })
  .trim()
  .min(1, "Título é obrigatório")
  .max(200, "Título deve ter no máximo 200 caracteres");

/**
 * Criação da OS. `number` é calculado no servidor (nunca aceito do cliente);
 * `org_id` vem da sessão. `status` inicial é sempre `open` (não configurável aqui).
 */
export const serviceOrderCreateSchema = z
  .object({
    title: titleField,
    assignedEmployeeId: optionalUuid.nullable().optional(),
    openedAt: z.iso.date("Data de abertura inválida (use AAAA-MM-DD)"),
    dueDate: optionalIsoDate,
    items: itemsField,
  })
  .strict();
export type ServiceOrderCreateInput = z.input<typeof serviceOrderCreateSchema>;
export type ServiceOrderCreateValues = z.output<typeof serviceOrderCreateSchema>;

/**
 * Atualização da OS. Preserva `id`/`number`/`org_id`/`created_at` (não editáveis).
 * `items` é substituição transacional da coleção (contrato). `status` transiciona
 * pela regra `canTransitionServiceOrder`.
 */
export const serviceOrderUpdateSchema = z
  .object({
    title: titleField,
    assignedEmployeeId: optionalUuid.nullable().optional(),
    openedAt: z.iso.date("Data de abertura inválida (use AAAA-MM-DD)"),
    dueDate: optionalIsoDate,
    closedAt: optionalIsoDate,
    status: serviceOrderStatusSchema,
    items: itemsField,
  })
  .strict();
export type ServiceOrderUpdateInput = z.input<typeof serviceOrderUpdateSchema>;
export type ServiceOrderUpdateValues = z.output<typeof serviceOrderUpdateSchema>;

// ── Filtros / paginação ───────────────────────────────────────────────────────

export const serviceOrderFiltersSchema = z
  .object({
    status: serviceOrderStatusSchema.optional(),
    q: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).optional(),
  })
  .strict();
export type ServiceOrderFilters = z.infer<typeof serviceOrderFiltersSchema>;

// ── View models ──────────────────────────────────────────────────────────────

export type SuggestedItem = {
  description: string;
  sourceType: ServiceOrderItemSource;
  sourceId: string | null;
};

export type ServiceOrderListItem = {
  id: string;
  number: number;
  title: string;
  status: string;
  statusLabel: string;
  openedAt: string;
  dueDate: string | null;
  closedAt: string | null;
  daysOpen: number;
  employeeName: string | null;
  itemCount: number;
};

export type ServiceOrderDetail = {
  order: ServiceOrder;
  statusLabel: string;
  daysOpen: number;
  employee: { id: string; fullName: string } | null;
  items: ServiceOrderItem[];
};

export function toServiceOrderListItem(
  row: {
    id: string;
    number: number;
    title: string;
    status: string;
    openedAt: string;
    dueDate: string | null;
    closedAt: string | null;
    employeeName: string | null;
    itemCount: number;
  },
  today: string,
): ServiceOrderListItem {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    status: row.status,
    statusLabel: serviceOrderStatusLabel(row.status),
    openedAt: row.openedAt,
    dueDate: row.dueDate,
    closedAt: row.closedAt,
    daysOpen: computeDaysOpen(row.openedAt, row.closedAt, today),
    employeeName: row.employeeName,
    itemCount: row.itemCount,
  };
}
