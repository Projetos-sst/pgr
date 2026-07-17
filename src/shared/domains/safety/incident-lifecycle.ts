import { z } from "zod";

/**
 * Ciclo de vida do incidente/acidente (Fase 06 / US4+US5) — **fonte única** das transições
 * de estado. Módulo **puro** (sem `server-only`): consumido pela UI (habilitar botões),
 * pelas Server Actions e pelo repositório (backstop real). Nenhuma outra camada pode
 * redefinir a matriz de transições ou a regra de justificativa.
 *
 * Bloco D implementa apenas a máquina de estados e a regra de justificativa. O avanço
 * automático pelo **primeiro plano de ação** e o **bloqueio de conclusão com plano ativo**
 * são acoplados no Bloco E (na mesma transação de `action_plans`) — NÃO aqui.
 */

// ── Estados (persistidos em accidents.status = enum accident_status) ────────────

export const INCIDENT_STATUSES = [
  "registered",
  "awaiting_planning",
  "awaiting_completion",
  "completed",
  "cancelled",
] as const;

export const incidentStatusSchema = z.enum(INCIDENT_STATUSES);
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  registered: "Registrado",
  awaiting_planning: "Aguardando planejamento",
  awaiting_completion: "Aguardando conclusão",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export function incidentStatusLabel(value: string | null): string {
  if (!value) return "—";
  return INCIDENT_STATUS_LABELS[value as IncidentStatus] ?? value;
}

// ── Matriz de transições (única fonte) ─────────────────────────────────────────

/**
 * Avanço linear `registered → awaiting_planning → awaiting_completion → completed`;
 * `cancelled` a partir de qualquer estado não terminal. Estados terminais
 * (`completed`/`cancelled`) não retrocedem. Transições são sempre manuais/explícitas.
 */
const TRANSITIONS: Record<IncidentStatus, ReadonlySet<IncidentStatus>> = {
  registered: new Set(["awaiting_planning", "cancelled"]),
  awaiting_planning: new Set(["awaiting_completion", "cancelled"]),
  awaiting_completion: new Set(["completed", "cancelled"]),
  completed: new Set(),
  cancelled: new Set(),
};

export function isTerminalIncidentStatus(status: string): boolean {
  return status === "completed" || status === "cancelled";
}

export function canTransitionIncident(from: IncidentStatus, to: IncidentStatus): boolean {
  return TRANSITIONS[from].has(to);
}

/** Alvos válidos a partir de `from` — usado pela UI para renderizar só botões legais. */
export function nextIncidentStatuses(from: IncidentStatus): IncidentStatus[] {
  return [...TRANSITIONS[from]];
}

/**
 * Conclusão e cancelamento exigem justificativa (FR-029; registro interno). É gravada em
 * `accidents.completion_justification`. Demais transições não exigem.
 */
export function requiresJustification(to: IncidentStatus): boolean {
  return to === "completed" || to === "cancelled";
}

export type IncidentTransitionCheck =
  | { ok: true }
  | { ok: false; reason: "invalid_transition" | "justification_required" };

/**
 * Validação **pura** de uma transição (sem throw): a camada que chama (repositório)
 * mapeia `invalid_transition`/`justification_required` para `VALIDATION` (422). A UI usa
 * o mesmo resultado para desabilitar ações inválidas — regra jamais duplicada.
 */
export function validateIncidentTransition(
  from: IncidentStatus,
  to: IncidentStatus,
  justification: string | null | undefined,
): IncidentTransitionCheck {
  if (!canTransitionIncident(from, to))
    return { ok: false, reason: "invalid_transition" };
  if (requiresJustification(to) && !justification?.trim()) {
    return { ok: false, reason: "justification_required" };
  }
  return { ok: true };
}
