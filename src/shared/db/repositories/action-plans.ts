import "server-only";

import { and, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";

import { accidentTypeLabel } from "@/shared/domains/safety/accident";
import {
  actionPlanPriorityLabel,
  actionPlanStatusLabel,
  canTransitionActionPlan,
  computeActionPlanOverdue,
  isActionPlanTerminal,
  type ActionPlanCreateValues,
  type ActionPlanDetail,
  type ActionPlanFilters,
  type ActionPlanListItem,
  type ActionPlanStatus,
  type ActionPlanUpdateValues,
} from "@/shared/domains/safety/action-plan";
import type {
  ActionPlanOriginType,
  OriginSnapshot,
} from "@/shared/domains/safety/action-plan-origin";
import { EntityInUseError } from "@/shared/errors/entity-in-use-error";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { resolvePageParams, type Paginated } from "@/shared/pagination";
import { todayInSaoPaulo } from "@/shared/dates";

import { accidents, actionPlans, risks, type ActionPlan } from "../schema";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";
import { advanceIncidentOnFirstPlanTx } from "./accidents";

const WRITE_EVENT = "safety.action_plans.write_rejected";
const countExpr = sql<number>`count(*)::int`;

// ── Validação e snapshot de origem (única fonte; risk|incident na V1) ───────────

/** Valida que a origem existe DENTRO do tenant. Origem inválida/cross-tenant → FK_NOT_FOUND. */
export async function assertOriginInTenant(
  tx: TenantTransaction,
  orgId: string,
  originType: ActionPlanOriginType,
  originId: string,
): Promise<void> {
  const table = originType === "risk" ? risks : accidents;
  const [row] = await tx
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.orgId, orgId), eq(table.id, originId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("origin");
}

/**
 * Resolve os snapshots de origem de várias linhas em 2 queries (sem N+1). Título é **seguro**:
 * descrição do risco ou tipo+data do incidente — **nunca** dado médico/PII. Origem apagada →
 * `removed: true`, mantendo o plano como histórico (FR-036).
 */
export async function loadOriginSnapshots(
  tx: TenantTransaction,
  orgId: string,
  refs: { originType: string; originId: string }[],
): Promise<Map<string, OriginSnapshot>> {
  const key = (t: string, id: string) => `${t}:${id}`;
  const result = new Map<string, OriginSnapshot>();

  const riskIds = refs.filter((r) => r.originType === "risk").map((r) => r.originId);
  const incidentIds = refs
    .filter((r) => r.originType === "incident")
    .map((r) => r.originId);

  if (riskIds.length > 0) {
    const rows = await tx
      .select({ id: risks.id, description: risks.description })
      .from(risks)
      .where(and(eq(risks.orgId, orgId), inArray(risks.id, riskIds)));
    for (const r of rows) {
      result.set(key("risk", r.id), {
        type: "risk",
        id: r.id,
        title: r.description,
        removed: false,
      });
    }
  }
  if (incidentIds.length > 0) {
    const rows = await tx
      .select({
        id: accidents.id,
        type: accidents.type,
        occurredAt: accidents.occurredAt,
      })
      .from(accidents)
      .where(and(eq(accidents.orgId, orgId), inArray(accidents.id, incidentIds)));
    for (const r of rows) {
      const date = r.occurredAt.toISOString().slice(0, 10);
      result.set(key("incident", r.id), {
        type: "incident",
        id: r.id,
        title: `${accidentTypeLabel(r.type)} — ${date}`,
        removed: false,
      });
    }
  }

  // Preenche origens ausentes (removidas) sem quebrar a listagem.
  for (const ref of refs) {
    const k = key(ref.originType, ref.originId);
    if (!result.has(k)) {
      result.set(k, {
        type: ref.originType as ActionPlanOriginType,
        id: ref.originId,
        title: null,
        removed: true,
      });
    }
  }
  return result;
}

// ── List ─────────────────────────────────────────────────────────────────────

export async function listActionPlans(
  orgId: string,
  filters: ActionPlanFilters = {},
): Promise<Paginated<ActionPlanListItem>> {
  const { limit, offset } = resolvePageParams(filters);
  const today = todayInSaoPaulo();
  const conditions: SQL[] = [eq(actionPlans.orgId, orgId)];
  if (filters.status) conditions.push(eq(actionPlans.status, filters.status));
  if (filters.priority != null)
    conditions.push(eq(actionPlans.priority, filters.priority));
  if (filters.originType) conditions.push(eq(actionPlans.originType, filters.originType));
  if (filters.originId) conditions.push(eq(actionPlans.originId, filters.originId));
  if (filters.whenFrom) conditions.push(gte(actionPlans.when, filters.whenFrom));
  if (filters.whenTo) conditions.push(lte(actionPlans.when, filters.whenTo));
  if (filters.overdue) {
    // Derivado: prazo vencido e ainda não terminal.
    conditions.push(
      sql`${actionPlans.when} is not null and ${actionPlans.when} < ${today} and ${actionPlans.status} not in ('completed','cancelled')`,
    );
  }
  const q = filters.q?.trim();
  if (q) {
    const term = `%${q}%`;
    conditions.push(or(ilike(actionPlans.what, term), ilike(actionPlans.who, term))!);
  }
  const where = and(...conditions);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: actionPlans.id,
        what: actionPlans.what,
        status: actionPlans.status,
        priority: actionPlans.priority,
        when: actionPlans.when,
        originType: actionPlans.originType,
        originId: actionPlans.originId,
      })
      .from(actionPlans)
      .where(where)
      .orderBy(desc(actionPlans.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: countExpr })
      .from(actionPlans)
      .where(where);

    const snapshots = await loadOriginSnapshots(tx, orgId, rows);
    const items: ActionPlanListItem[] = rows.map((r) => ({
      id: r.id,
      what: r.what,
      status: r.status,
      statusLabel: actionPlanStatusLabel(r.status),
      priority: r.priority,
      priorityLabel: actionPlanPriorityLabel(r.priority),
      when: r.when,
      overdue: computeActionPlanOverdue(r.when, r.status, today),
      origin: snapshots.get(`${r.originType}:${r.originId}`)!,
    }));
    return { rows: items, total };
  });
}

export async function getActionPlanById(
  orgId: string,
  id: string,
): Promise<ActionPlanDetail | null> {
  const today = todayInSaoPaulo();
  return withOrg(orgId, async (tx) => {
    const [plan] = await tx
      .select()
      .from(actionPlans)
      .where(and(eq(actionPlans.orgId, orgId), eq(actionPlans.id, id)))
      .limit(1);
    if (!plan) return null;
    const snapshots = await loadOriginSnapshots(tx, orgId, [plan]);
    return {
      plan,
      overdue: computeActionPlanOverdue(plan.when, plan.status, today),
      origin: snapshots.get(`${plan.originType}:${plan.originId}`)!,
    };
  });
}

// ── Create (orquestra a transação: origem + plano + avanço do incidente) ────────

export async function createActionPlan(
  orgId: string,
  values: ActionPlanCreateValues,
): Promise<ActionPlan> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      await assertOriginInTenant(tx, orgId, values.originType, values.originId);
      const [plan] = await tx
        .insert(actionPlans)
        .values({
          orgId,
          originType: values.originType,
          originId: values.originId,
          what: values.what,
          why: values.why,
          who: values.who,
          where: values.where,
          when: values.when ?? null,
          how: values.how,
          howMuch: values.howMuch != null ? String(values.howMuch) : null,
          priority: values.priority ?? null,
          status: "planned",
        })
        .returning();
      // Acoplamento unidirecional: o 1º plano ativo avança o incidente (mesma transação).
      if (values.originType === "incident") {
        await advanceIncidentOnFirstPlanTx(tx, orgId, values.originId);
      }
      return plan;
    }),
  );
}

// ── Update (preserva origem/status; terminal imutável) ──────────────────────────

export async function updateActionPlan(
  orgId: string,
  id: string,
  values: ActionPlanUpdateValues,
): Promise<ActionPlan | null> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [current] = await tx
        .select({ status: actionPlans.status })
        .from(actionPlans)
        .where(and(eq(actionPlans.orgId, orgId), eq(actionPlans.id, id)))
        .limit(1);
      if (!current) return null;
      if (isActionPlanTerminal(current.status)) {
        throw new ValidationError("Plano em estado terminal não pode ser editado.");
      }
      const [row] = await tx
        .update(actionPlans)
        .set({
          what: values.what,
          why: values.why,
          who: values.who,
          where: values.where,
          when: values.when ?? null,
          how: values.how,
          howMuch: values.howMuch != null ? String(values.howMuch) : null,
          priority: values.priority ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(actionPlans.orgId, orgId), eq(actionPlans.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

// ── Transição de status (completed_at/cancelled_at; terminal não retrocede) ──────

export async function setActionPlanStatus(
  orgId: string,
  id: string,
  to: ActionPlanStatus,
): Promise<ActionPlan | null> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [current] = await tx
        .select({ status: actionPlans.status })
        .from(actionPlans)
        .where(and(eq(actionPlans.orgId, orgId), eq(actionPlans.id, id)))
        .limit(1);
      if (!current) return null;
      if (!canTransitionActionPlan(current.status as ActionPlanStatus, to)) {
        throw new ValidationError("Transição de estado inválida para o plano.");
      }
      const [row] = await tx
        .update(actionPlans)
        .set({
          status: to,
          completedAt: to === "completed" ? new Date() : null,
          cancelledAt: to === "cancelled" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(and(eq(actionPlans.orgId, orgId), eq(actionPlans.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

// ── Exclusão física só se `planned`; senão cancelar (FR-035) ────────────────────

export async function deleteActionPlan(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [current] = await tx
        .select({ status: actionPlans.status })
        .from(actionPlans)
        .where(and(eq(actionPlans.orgId, orgId), eq(actionPlans.id, id)))
        .limit(1);
      if (!current) return false;
      // Só planos ainda não iniciados podem ser excluídos fisicamente; senão, cancelar.
      if (current.status !== "planned") {
        throw new EntityInUseError(
          "Plano já iniciado ou finalizado não pode ser excluído; utilize o cancelamento.",
        );
      }
      const rows = await tx
        .delete(actionPlans)
        .where(and(eq(actionPlans.orgId, orgId), eq(actionPlans.id, id)))
        .returning({ id: actionPlans.id });
      return rows.length > 0;
    }),
  );
}
