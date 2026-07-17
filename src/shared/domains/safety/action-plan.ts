import { z } from "zod";

import {
  optionalIsoDate,
  requiredString,
  requiredUuid,
} from "@/shared/domains/pgr/form-fields";
import type { ActionPlan } from "@/shared/db/schema";

import {
  actionPlanOriginTypeSchema,
  originTypeLabel,
  type OriginSnapshot,
} from "./action-plan-origin";

/**
 * Domínio do Plano de Ação 5W2H (Fase 06 / US6). `.strict()` em todos os schemas; `org_id`,
 * timestamps, `completed_at`/`cancelled_at` e `status` nunca vêm do cliente. `overdue` é sempre
 * **derivado** (nunca persistido). Acoplamento unidirecional com o incidente vive em
 * `incident-lifecycle.ts`.
 */

// ── Status ──────────────────────────────────────────────────────────────────────

export const actionPlanStatusSchema = z.enum([
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);
export type ActionPlanStatus = z.infer<typeof actionPlanStatusSchema>;

export const ACTION_PLAN_STATUS_LABELS: Record<ActionPlanStatus, string> = {
  planned: "Planejado",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export function actionPlanStatusLabel(value: string | null): string {
  if (!value) return "—";
  return ACTION_PLAN_STATUS_LABELS[value as ActionPlanStatus] ?? value;
}

const STATUS_TRANSITIONS: Record<ActionPlanStatus, ReadonlySet<ActionPlanStatus>> = {
  planned: new Set(["in_progress", "completed", "cancelled"]),
  in_progress: new Set(["completed", "cancelled"]),
  completed: new Set(),
  cancelled: new Set(),
};

export function isActionPlanTerminal(status: string): boolean {
  return status === "completed" || status === "cancelled";
}

/** Um plano é **ativo** (pendente) enquanto não é terminal. Base do bloqueio de conclusão. */
export function isActionPlanActive(status: string): boolean {
  return status === "planned" || status === "in_progress";
}

export function canTransitionActionPlan(
  from: ActionPlanStatus,
  to: ActionPlanStatus,
): boolean {
  return STATUS_TRANSITIONS[from].has(to);
}

// ── Priority (smallint 1–3, decisão do Bloco A) ─────────────────────────────────

export const actionPlanPrioritySchema = z.coerce.number().int().min(1).max(3);

export const ACTION_PLAN_PRIORITY_LABELS: Record<number, string> = {
  1: "Baixa",
  2: "Média",
  3: "Alta",
};

export function actionPlanPriorityLabel(value: number | null): string {
  if (value == null) return "—";
  return ACTION_PLAN_PRIORITY_LABELS[value] ?? String(value);
}

// ── Campos 5W2H ────────────────────────────────────────────────────────────────

const MAX_5W2H = 2000;
const w = (label: string) =>
  requiredString(`${label} é obrigatório`).pipe(
    z.string().max(MAX_5W2H, `${label} deve ter no máximo ${MAX_5W2H} caracteres`),
  );

const optionalMoney = z.coerce.number().min(0, "Custo não pode ser negativo").optional();

const fiveW2hShape = {
  what: w("O quê"),
  why: w("Por quê"),
  who: w("Quem"),
  where: w("Onde"),
  when: optionalIsoDate,
  how: w("Como"),
  howMuch: optionalMoney,
  priority: actionPlanPrioritySchema.optional(),
} as const;

// ── Create / Update ─────────────────────────────────────────────────────────────

/** Criação: 5W2H + origem (`risk|incident`). `status` inicial é sempre `planned` no servidor. */
export const actionPlanCreateSchema = z
  .object({
    originType: actionPlanOriginTypeSchema,
    originId: requiredUuid("Origem inválida"),
    ...fiveW2hShape,
  })
  .strict();
export type ActionPlanCreateInput = z.input<typeof actionPlanCreateSchema>;
export type ActionPlanCreateValues = z.output<typeof actionPlanCreateSchema>;

/**
 * Atualização: só o conteúdo 5W2H + prioridade/prazo. Preserva `id`/`org_id`/`origin_type`/
 * `origin_id`/`created_at`; `status` muda **apenas** pelo fluxo dedicado (não por update genérico).
 */
export const actionPlanUpdateSchema = z.object(fiveW2hShape).strict();
export type ActionPlanUpdateInput = z.input<typeof actionPlanUpdateSchema>;
export type ActionPlanUpdateValues = z.output<typeof actionPlanUpdateSchema>;

// ── Transição de status ──────────────────────────────────────────────────────────

export const actionPlanStatusTransitionSchema = z
  .object({ status: actionPlanStatusSchema })
  .strict();
export type ActionPlanStatusTransitionInput = z.input<
  typeof actionPlanStatusTransitionSchema
>;

// ── Filtros / paginação ───────────────────────────────────────────────────────

export const actionPlanFiltersSchema = z
  .object({
    status: actionPlanStatusSchema.optional(),
    priority: actionPlanPrioritySchema.optional(),
    originType: actionPlanOriginTypeSchema.optional(),
    originId: z.string().uuid().optional(),
    whenFrom: z.iso.date().optional(),
    whenTo: z.iso.date().optional(),
    overdue: z.coerce.boolean().optional(),
    q: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).optional(),
  })
  .strict();
export type ActionPlanFilters = z.infer<typeof actionPlanFiltersSchema>;

// ── Overdue (derivado, fuso America/Sao_Paulo via `today`) ──────────────────────

/** Atrasado ⇔ `when < hoje` e status não terminal. `today`/`when` em `AAAA-MM-DD`. */
export function computeActionPlanOverdue(
  when: string | null,
  status: string,
  today: string,
): boolean {
  if (!when) return false;
  if (isActionPlanTerminal(status)) return false;
  return when < today;
}

// ── View models ──────────────────────────────────────────────────────────────

export type ActionPlanListItem = {
  id: string;
  what: string;
  status: string;
  statusLabel: string;
  priority: number | null;
  priorityLabel: string;
  when: string | null;
  overdue: boolean;
  origin: OriginSnapshot;
};

export type ActionPlanDetail = {
  plan: ActionPlan;
  overdue: boolean;
  origin: OriginSnapshot;
};

export { originTypeLabel };
export type { ActionPlan, OriginSnapshot };
