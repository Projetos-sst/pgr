import "server-only";

import { and, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";

import {
  toAccidentListItem,
  type AccidentCreateValues,
  type AccidentFilters,
  type AccidentListItem,
  type AccidentUpdateValues,
} from "@/shared/domains/safety/accident";
import {
  isTerminalIncidentStatus,
  requiresJustification,
  shouldAdvanceOnNewActivePlan,
  validateIncidentTransition,
  type IncidentStatus,
} from "@/shared/domains/safety/incident-lifecycle";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { resolvePageParams, type Paginated } from "@/shared/pagination";

import { accidents, actionPlans, companies, employees, type Accident } from "../schema";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

/** Status de plano que contam como **ativos** (pendentes) — bloqueiam a conclusão do incidente. */
const ACTIVE_PLAN_STATUSES = ["planned", "in_progress"] as const;

// Auditoria de fronteira sem PII/dado de saúde: apenas o nome da operação (FR-026).
const WRITE_EVENT = "safety.accidents.write_rejected";
const countExpr = sql<number>`count(*)::int`;

/** Empresa deve existir no tenant ativo (origem obrigatória do incidente). */
async function assertCompanyInTenant(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("company");
}

/** Funcionário (opcional) deve existir no tenant ativo quando informado. */
async function assertEmployeeInTenant(
  tx: TenantTransaction,
  orgId: string,
  employeeId: string | null | undefined,
): Promise<void> {
  if (!employeeId) return;
  const [row] = await tx
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.orgId, orgId), eq(employees.id, employeeId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("employee");
}

/** Converte os valores validados do domínio em colunas do banco (sem `status`/timestamps). */
function accidentColumns(values: AccidentCreateValues | AccidentUpdateValues) {
  return {
    companyId: values.companyId,
    employeeId: values.employeeId ?? null,
    occurredAt: new Date(values.occurredAt),
    type: values.type,
    category: values.category,
    severity: values.severity,
    location: values.location ?? null,
    description: values.description ?? null,
    awayFromWork: values.awayFromWork ?? null,
    workedHours: values.workedHours != null ? String(values.workedHours) : null,
    hospital: values.hospital ?? null,
    injuryNatureCode: values.injuryNatureCode ?? null,
    injuryNatureDescription: values.injuryNatureDescription ?? null,
    bodyPartCode: values.bodyPartCode ?? null,
    bodyPartDescription: values.bodyPartDescription ?? null,
    causativeAgentCode: values.causativeAgentCode ?? null,
    causativeAgentDescription: values.causativeAgentDescription ?? null,
    causes: values.causes ?? null,
    environmentalImpact: values.environmentalImpact ?? null,
    materialLoss: values.materialLoss ?? null,
    thirdParties: values.thirdParties ?? null,
    fatalityPotential: values.fatalityPotential ?? null,
    responsibleArea: values.responsibleArea ?? null,
    activityProcedure: values.activityProcedure ?? null,
    witnesses: values.witnesses ?? null,
    investigationNotes: values.investigationNotes ?? null,
    catNumber: values.catNumber ?? null,
    catIssuedAt: values.catIssuedAt ?? null,
  };
}

export async function listAccidents(
  orgId: string,
  filters: AccidentFilters = {},
): Promise<Paginated<AccidentListItem>> {
  const { limit, offset } = resolvePageParams(filters);
  const conditions: SQL[] = [eq(accidents.orgId, orgId)];
  if (filters.status) conditions.push(eq(accidents.status, filters.status));
  if (filters.type) conditions.push(eq(accidents.type, filters.type));
  if (filters.category) conditions.push(eq(accidents.category, filters.category));
  if (filters.severity) conditions.push(eq(accidents.severity, filters.severity));
  if (filters.companyId) conditions.push(eq(accidents.companyId, filters.companyId));
  if (filters.employeeId) conditions.push(eq(accidents.employeeId, filters.employeeId));
  if (filters.occurredFrom) {
    conditions.push(gte(accidents.occurredAt, new Date(filters.occurredFrom)));
  }
  if (filters.occurredTo) {
    conditions.push(
      lte(accidents.occurredAt, new Date(`${filters.occurredTo}T23:59:59.999Z`)),
    );
  }
  const q = filters.q?.trim();
  if (q) {
    // Busca apenas em campos NÃO sensíveis (local/área/nº CAT) — nunca em saúde/investigação.
    const term = `%${q}%`;
    conditions.push(
      or(
        ilike(accidents.location, term),
        ilike(accidents.responsibleArea, term),
        ilike(accidents.catNumber, term),
      )!,
    );
  }
  const where = and(...conditions);
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: accidents.id,
        occurredAt: accidents.occurredAt,
        type: accidents.type,
        category: accidents.category,
        severity: accidents.severity,
        status: accidents.status,
        companyName: companies.razaoSocial,
      })
      .from(accidents)
      .leftJoin(companies, eq(companies.id, accidents.companyId))
      .where(where)
      .orderBy(desc(accidents.occurredAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: countExpr })
      .from(accidents)
      .where(where);
    return { rows: rows.map(toAccidentListItem), total };
  });
}

export async function getAccidentById(
  orgId: string,
  id: string,
): Promise<Accident | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(accidents)
      .where(and(eq(accidents.orgId, orgId), eq(accidents.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createAccident(
  orgId: string,
  values: AccidentCreateValues,
): Promise<Accident> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      await assertCompanyInTenant(tx, orgId, values.companyId);
      await assertEmployeeInTenant(tx, orgId, values.employeeId);
      const [row] = await tx
        .insert(accidents)
        .values({ orgId, status: "registered", ...accidentColumns(values) })
        .returning();
      return row;
    }),
  );
}

export async function updateAccident(
  orgId: string,
  id: string,
  values: AccidentUpdateValues,
): Promise<Accident | null> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [current] = await tx
        .select({ id: accidents.id, status: accidents.status })
        .from(accidents)
        .where(and(eq(accidents.orgId, orgId), eq(accidents.id, id)))
        .limit(1);
      if (!current) return null;
      // Estados terminais são imutáveis (state machine); a mudança de status só ocorre
      // por `setAccidentStatus` (nunca silenciosamente pelo update de conteúdo).
      if (isTerminalIncidentStatus(current.status)) {
        throw new ValidationError("Incidente em estado terminal não pode ser editado.");
      }
      await assertCompanyInTenant(tx, orgId, values.companyId);
      await assertEmployeeInTenant(tx, orgId, values.employeeId);
      const [row] = await tx
        .update(accidents)
        .set({ ...accidentColumns(values), updatedAt: new Date() })
        .where(and(eq(accidents.orgId, orgId), eq(accidents.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteAccident(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(accidents)
        .where(and(eq(accidents.orgId, orgId), eq(accidents.id, id)))
        .returning({ id: accidents.id });
      return rows.length > 0;
    }),
  );
}

/**
 * Transição de estado explícita. Aplica a regra pura de `incident-lifecycle` (fonte única):
 * transição legal + justificativa obrigatória em conclusão/cancelamento. Grava `completed_at`
 * ao concluir e `completion_justification` quando exigida. Terminal não retrocede.
 */
export async function setAccidentStatus(
  orgId: string,
  id: string,
  to: IncidentStatus,
  justification: string | null | undefined,
): Promise<Accident | null> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [current] = await tx
        .select({ status: accidents.status })
        .from(accidents)
        .where(and(eq(accidents.orgId, orgId), eq(accidents.id, id)))
        .limit(1);
      if (!current) return null;

      // Conclusão é bloqueada com plano ativo (SC-009): a contagem roda na MESMA transação,
      // então um plano criado concorrentemente não escapa entre o teste e o commit.
      const activePlanCount =
        to === "completed" ? await countActivePlansForIncidentTx(tx, orgId, id) : 0;

      const check = validateIncidentTransition(
        current.status as IncidentStatus,
        to,
        justification,
        { activePlanCount },
      );
      if (!check.ok) {
        throw new ValidationError(
          check.reason === "justification_required"
            ? "Justificativa é obrigatória para concluir ou cancelar o incidente."
            : check.reason === "blocked_by_active_plans"
              ? "Incidente com plano de ação ativo não pode ser concluído."
              : "Transição de estado inválida para o incidente.",
        );
      }

      const [row] = await tx
        .update(accidents)
        .set({
          status: to,
          completedAt: to === "completed" ? new Date() : null,
          completionJustification: requiresJustification(to)
            ? (justification?.trim() ?? null)
            : null,
          updatedAt: new Date(),
        })
        .where(and(eq(accidents.orgId, orgId), eq(accidents.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

// ── Acoplamento com o ciclo de vida do incidente (Bloco E, camada única) ────────
//
// O repositório de `action_plans` **orquestra a transação**; estes helpers, coesos aqui,
// aplicam as regras de `incident-lifecycle.ts`. Acoplamento **unidirecional**: planos avançam
// o incidente; nada aqui escreve em `action_plans` além de contar.

/** Conta planos ativos (`planned`/`in_progress`) de um incidente, dentro da transação dada. */
export function countActivePlansForIncidentTx(
  tx: TenantTransaction,
  orgId: string,
  incidentId: string,
): Promise<number> {
  return tx
    .select({ total: countExpr })
    .from(actionPlans)
    .where(
      and(
        eq(actionPlans.orgId, orgId),
        eq(actionPlans.originType, "incident"),
        eq(actionPlans.originId, incidentId),
        inArray(actionPlans.status, [...ACTIVE_PLAN_STATUSES]),
      ),
    )
    .then(([r]) => r?.total ?? 0);
}

/** Versão pública (abre `withOrg`) para a UI de gestão exibir a contagem de planos pendentes. */
export function countActivePlansForIncident(
  orgId: string,
  incidentId: string,
): Promise<number> {
  return withOrg(orgId, (tx) => countActivePlansForIncidentTx(tx, orgId, incidentId));
}

/**
 * Avança o incidente `awaiting_planning → awaiting_completion` na criação do **primeiro plano
 * ativo** (regra pura `shouldAdvanceOnNewActivePlan`). Idempotente e chamado **dentro** da
 * transação de criação do plano (`action-plans.ts`). Só toca o incidente do tenant ativo.
 */
export async function advanceIncidentOnFirstPlanTx(
  tx: TenantTransaction,
  orgId: string,
  incidentId: string,
): Promise<void> {
  const [current] = await tx
    .select({ status: accidents.status })
    .from(accidents)
    .where(and(eq(accidents.orgId, orgId), eq(accidents.id, incidentId)))
    .limit(1);
  if (!current) return;
  if (!shouldAdvanceOnNewActivePlan(current.status as IncidentStatus)) return;
  await tx
    .update(accidents)
    .set({ status: "awaiting_completion", updatedAt: new Date() })
    .where(and(eq(accidents.orgId, orgId), eq(accidents.id, incidentId)));
}
