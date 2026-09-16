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

/**
 * Descrição curta do evento (coluna "Descrição" do redesign) — separada do
 * código (`S-22xx`) que vai na coluna "Evento". Fonte ÚNICA do texto: a UI e o
 * painel consomem daqui, nunca redeclaram.
 */
export const EVENT_TYPE_DESCRIPTIONS: Record<EsocialEventType, string> = {
  "S-2190": "Registro Preliminar de Admissão",
  "S-2200": "Admissão / Cadastramento Inicial",
  "S-2210": "CAT — Comunicação de Acidente de Trabalho",
  "S-2220": "Monitoramento da Saúde do Trabalhador",
  "S-2221": "Exame Toxicológico do Motorista",
  "S-2240": "Condições Ambientais do Trabalho",
  "S-2300": "Trabalhador Sem Vínculo — Início",
};

export function eventTypeDescription(value: string): string {
  return EVENT_TYPE_DESCRIPTIONS[value as EsocialEventType] ?? value;
}

/**
 * A que entidade o `reference_id` (polimórfico, sem FK) aponta em cada tipo.
 * S-2240 referencia um RISCO (agente nocivo), não um funcionário — por isso a
 * coluna "Funcionário" fica vazia nesse tipo em vez de inventar um nome.
 */
export type EsocialReferenceKind = "employee" | "risk" | "none";

const REFERENCE_KIND: Record<EsocialEventType, EsocialReferenceKind> = {
  "S-2190": "employee",
  "S-2200": "employee",
  "S-2210": "employee",
  "S-2220": "employee",
  "S-2221": "employee",
  "S-2240": "risk",
  "S-2300": "employee",
};

export function esocialReferenceKind(eventType: string): EsocialReferenceKind {
  return REFERENCE_KIND[eventType as EsocialEventType] ?? "none";
}

// ── Painel (#218) — buckets de KPI e conformidade ───────────────────────────
// Partição COMPLETA dos 6 status (nenhum evento fica de fora nem é contado 2x).
export type EventStatusBucket = "pending" | "transmitted" | "failed";

export function eventStatusBucket(status: string): EventStatusBucket {
  if (status === "draft" || status === "pending") return "pending";
  if (status === "sent" || status === "accepted") return "transmitted";
  return "failed"; // rejected | error
}

export type EsocialDashboardCounts = {
  transmitted: number;
  pending: number;
  failed: number;
  total: number;
  /** `null` quando nenhum evento teve veredito ainda (evita divisão por zero). */
  conformityPercent: number | null;
};

/**
 * Conformidade = aceitos ÷ eventos COM VEREDITO (aceito + rejeitado + erro).
 * Eventos ainda em trânsito (`sent`) e não enviados (`draft`/`pending`) não
 * entram no denominador — não seria honesto penalizar o que o governo ainda não
 * respondeu. Sem veredito → `null` (a UI mostra "—", nunca 0% ou 100% falso).
 */
export function computeConformityPercent(counts: {
  accepted: number;
  rejected: number;
  error: number;
}): number | null {
  const decided = counts.accepted + counts.rejected + counts.error;
  if (decided <= 0) return null;
  return Math.round((counts.accepted / decided) * 100);
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
  /** Coluna "Descrição" — derivada do tipo. */
  description: string;
  status: string;
  statusLabel: string;
  referenceId: string | null;
  /** Coluna "Funcionário" — `null` quando o tipo não referencia funcionário
   *  (ex.: S-2240 aponta para risco) ou o registro não existe mais. */
  employeeName: string | null;
  batchId: string | null;
  /** Coluna "Data Envio" — do lote (`esocial_batches.sent_at`); `null` sem lote. */
  sentAt: string | null;
  /** Coluna "Protocolo" — do lote; `null` enquanto não transmitido. */
  protocolNumber: string | null;
  createdAt: string;
};

/** Linha do feed "eventos recentes" do painel (#218). */
export type EsocialRecentEvent = {
  id: string;
  eventType: string;
  description: string;
  status: string;
  statusLabel: string;
  employeeName: string | null;
  createdAt: string;
};

/** Contagem por tipo do bloco "Eventos por Tipo" (#218). */
export type EsocialTypeCount = {
  eventType: string;
  description: string;
  count: number;
};

export type EsocialDashboard = EsocialDashboardCounts & {
  byType: EsocialTypeCount[];
  recent: EsocialRecentEvent[];
};

function toIso(v: Date | string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

export function toEventListItem(row: {
  id: string;
  eventType: string;
  status: string;
  referenceId: string | null;
  batchId: string | null;
  createdAt: Date | string;
  /** Vem do LEFT JOIN em `employees` (só faz sentido nos tipos de funcionário). */
  employeeName?: string | null;
  /** Vêm do LEFT JOIN em `esocial_batches` (many-to-one → sem duplicar linha). */
  sentAt?: Date | string | null;
  protocolNumber?: string | null;
}): EventListItem {
  // Só expõe funcionário quando o tipo de evento de fato referencia um: em
  // S-2240 o `reference_id` é um risco — a coluna fica vazia, sem inventar dado.
  const employeeName =
    esocialReferenceKind(row.eventType) === "employee"
      ? (row.employeeName ?? null)
      : null;
  return {
    id: row.id,
    eventType: row.eventType,
    eventTypeLabel: eventTypeLabel(row.eventType),
    description: eventTypeDescription(row.eventType),
    status: row.status,
    statusLabel: eventStatusLabel(row.status),
    referenceId: row.referenceId,
    employeeName,
    batchId: row.batchId,
    sentAt: toIso(row.sentAt),
    protocolNumber: row.protocolNumber ?? null,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

export type EsocialEventDetail = EsocialEvent;
