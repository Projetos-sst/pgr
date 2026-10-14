import { z } from "zod";

import { optionalString, requiredUuid } from "@/shared/domains/pgr/form-fields";
import type { RiskAudit } from "@/shared/db/schema";

import {
  actionPlanOriginTypeSchema,
  originTypeLabel,
  type OriginSnapshot,
} from "./action-plan-origin";
import type { ActionPlanListItem } from "./action-plan";

/**
 * Domínio da Auditoria/Análise de Risco (Fase 06 / US7) — **fonte única** da máquina de
 * estados do kanban. `.strict()` em todos os schemas; `org_id`, `status`, `started_at`,
 * `completed_at` e timestamps são **server-only** e nunca vêm do cliente. Origem reusa a
 * allowlist `risk|incident` de `action-plan-origin.ts` (mesma regra, nunca duplicada).
 */

// ── Estados (persistidos em risk_audits.status = enum risk_audit_status) ─────────

export const RISK_AUDIT_STATUSES = [
  "awaiting_analysis",
  "planning_actions",
  "completed",
] as const;

export const riskAuditStatusSchema = z.enum(RISK_AUDIT_STATUSES);
export type RiskAuditStatus = z.infer<typeof riskAuditStatusSchema>;

export const RISK_AUDIT_STATUS_LABELS: Record<RiskAuditStatus, string> = {
  awaiting_analysis: "Aguardando análise",
  planning_actions: "Planejando ações",
  completed: "Concluído",
};

export function riskAuditStatusLabel(value: string | null): string {
  if (!value) return "—";
  return RISK_AUDIT_STATUS_LABELS[value as RiskAuditStatus] ?? value;
}

// ── Matriz de transições (única fonte) ─────────────────────────────────────────

/**
 * Avanço linear `awaiting_analysis → planning_actions → completed`. Estados anteriores
 * **não reabrem**; `completed` é terminal (não retrocede). Transições são sempre
 * **explícitas** (via Action/botão) — nunca por drag-and-drop persistente (SC-011/US7).
 */
const TRANSITIONS: Record<RiskAuditStatus, ReadonlySet<RiskAuditStatus>> = {
  awaiting_analysis: new Set(["planning_actions"]),
  planning_actions: new Set(["completed"]),
  completed: new Set(),
};

export function isTerminalRiskAuditStatus(status: string): boolean {
  return status === "completed";
}

export function canTransitionRiskAudit(
  from: RiskAuditStatus,
  to: RiskAuditStatus,
): boolean {
  return TRANSITIONS[from].has(to);
}

/** Alvos válidos a partir de `from` — usado pela UI para renderizar só a ação legal. */
export function nextRiskAuditStatuses(from: RiskAuditStatus): RiskAuditStatus[] {
  return [...TRANSITIONS[from]];
}

/**
 * Conclusão exige justificativa (regra aprovada; gravada em `risk_audits.justification`).
 * Demais transições não exigem. Nunca registrar a justificativa integral em log/audit.
 */
export function requiresRiskAuditJustification(to: RiskAuditStatus): boolean {
  return to === "completed";
}

export type RiskAuditTransitionCheck =
  { ok: true } | { ok: false; reason: "invalid_transition" | "justification_required" };

/**
 * Validação **pura** de uma transição (sem throw): o repositório mapeia `invalid_transition`
 * e `justification_required` para `VALIDATION` (422). A UI usa o mesmo resultado para
 * desabilitar ações inválidas — regra jamais duplicada.
 */
export function validateRiskAuditTransition(
  from: RiskAuditStatus,
  to: RiskAuditStatus,
  justification: string | null | undefined,
): RiskAuditTransitionCheck {
  if (!canTransitionRiskAudit(from, to))
    return { ok: false, reason: "invalid_transition" };
  if (requiresRiskAuditJustification(to) && !justification?.trim()) {
    return { ok: false, reason: "justification_required" };
  }
  return { ok: true };
}

// ── Create / Transição / Filtros ─────────────────────────────────────────────────

/** Criação: só a origem (`risk|incident`). `status` inicial é sempre `awaiting_analysis`. */
export const riskAuditCreateSchema = z
  .object({
    originType: actionPlanOriginTypeSchema,
    originId: requiredUuid("Origem inválida"),
  })
  .strict();
export type RiskAuditCreateInput = z.input<typeof riskAuditCreateSchema>;
export type RiskAuditCreateValues = z.output<typeof riskAuditCreateSchema>;

/** Transição explícita: estado-alvo + justificativa (obrigatória só na conclusão). */
export const riskAuditStatusTransitionSchema = z
  .object({
    status: riskAuditStatusSchema,
    justification: optionalString,
  })
  .strict();
export type RiskAuditStatusTransitionInput = z.input<
  typeof riskAuditStatusTransitionSchema
>;
export type RiskAuditStatusTransitionValues = z.output<
  typeof riskAuditStatusTransitionSchema
>;

export const riskAuditFiltersSchema = z
  .object({
    status: riskAuditStatusSchema.optional(),
    originType: actionPlanOriginTypeSchema.optional(),
    originId: z.string().uuid().optional(),
    q: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).optional(),
  })
  .strict();
export type RiskAuditFilters = z.infer<typeof riskAuditFiltersSchema>;

// ── View models ──────────────────────────────────────────────────────────────

/** Item do kanban: só dados seguros (nunca PII/dado médico). */
export type RiskAuditListItem = {
  id: string;
  status: string;
  statusLabel: string;
  origin: OriginSnapshot;
  planCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

/** Detalhe: auditoria + origem resolvida/removida + planos vinculados à mesma origem. */
export type RiskAuditDetail = {
  audit: RiskAudit;
  origin: OriginSnapshot;
  plans: ActionPlanListItem[];
};

export { originTypeLabel };
export type { RiskAudit, OriginSnapshot };
