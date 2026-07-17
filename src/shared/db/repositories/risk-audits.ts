import "server-only";

import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import type { ActionPlanOriginType } from "@/shared/domains/safety/action-plan-origin";
import {
  riskAuditStatusLabel,
  validateRiskAuditTransition,
  type RiskAuditCreateValues,
  type RiskAuditDetail,
  type RiskAuditFilters,
  type RiskAuditListItem,
  type RiskAuditStatus,
} from "@/shared/domains/safety/risk-audit";
import { EntityInUseError } from "@/shared/errors/entity-in-use-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { resolvePageParams, type Paginated } from "@/shared/pagination";

import {
  accidents,
  actionPlans,
  ges,
  gesJobRoles,
  jobRoles,
  riskAudits,
  risks,
  type RiskAudit,
} from "../schema";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";
import {
  assertOriginInTenant,
  listActionPlans,
  loadOriginSnapshots,
} from "./action-plans";

// Auditoria de fronteira sem PII/dado de saúde (FR-026): apenas o nome da operação.
const WRITE_EVENT = "safety.risk_audits.write_rejected";
const countExpr = sql<number>`count(*)::int`;

/** Detecta a violação da UNIQUE parcial (uma ativa por origem) na cadeia de `cause`. */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth <= 5 && current; depth += 1) {
    if (
      typeof current === "object" &&
      "code" in current &&
      (current as { code: unknown }).code === "23505"
    ) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Conta planos vinculados a cada origem (batched, sem N+1) → mapa `type:id → total`. */
async function loadPlanCounts(
  tx: TenantTransaction,
  orgId: string,
  refs: { originType: string; originId: string }[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const ids = refs.map((r) => r.originId);
  if (ids.length === 0) return counts;
  const rows = await tx
    .select({
      originType: actionPlans.originType,
      originId: actionPlans.originId,
      total: countExpr,
    })
    .from(actionPlans)
    .where(and(eq(actionPlans.orgId, orgId), inArray(actionPlans.originId, ids)))
    .groupBy(actionPlans.originType, actionPlans.originId);
  for (const r of rows) counts.set(`${r.originType}:${r.originId}`, r.total);
  return counts;
}

// ── List (kanban) ──────────────────────────────────────────────────────────────

export async function listRiskAudits(
  orgId: string,
  filters: RiskAuditFilters = {},
): Promise<Paginated<RiskAuditListItem>> {
  const { limit, offset } = resolvePageParams(filters);
  const conditions: SQL[] = [eq(riskAudits.orgId, orgId)];
  if (filters.status) conditions.push(eq(riskAudits.status, filters.status));
  if (filters.originType) conditions.push(eq(riskAudits.originType, filters.originType));
  if (filters.originId) conditions.push(eq(riskAudits.originId, filters.originId));
  const where = and(...conditions);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: riskAudits.id,
        status: riskAudits.status,
        originType: riskAudits.originType,
        originId: riskAudits.originId,
        startedAt: riskAudits.startedAt,
        completedAt: riskAudits.completedAt,
        createdAt: riskAudits.createdAt,
      })
      .from(riskAudits)
      .where(where)
      .orderBy(desc(riskAudits.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: countExpr })
      .from(riskAudits)
      .where(where);

    const [snapshots, planCounts] = await Promise.all([
      loadOriginSnapshots(tx, orgId, rows),
      loadPlanCounts(tx, orgId, rows),
    ]);
    const items: RiskAuditListItem[] = rows.map((r) => {
      const key = `${r.originType}:${r.originId}`;
      return {
        id: r.id,
        status: r.status,
        statusLabel: riskAuditStatusLabel(r.status),
        origin: snapshots.get(key)!,
        planCount: planCounts.get(key) ?? 0,
        startedAt: r.startedAt?.toISOString() ?? null,
        completedAt: r.completedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    });
    return { rows: items, total };
  });
}

// ── Get (auditoria + origem segura + planos da mesma origem) ─────────────────────

export async function getRiskAudit(
  orgId: string,
  id: string,
): Promise<RiskAuditDetail | null> {
  const audit = await withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(riskAudits)
      .where(and(eq(riskAudits.orgId, orgId), eq(riskAudits.id, id)))
      .limit(1);
    if (!row) return null;
    const snapshots = await loadOriginSnapshots(tx, orgId, [row]);
    return { row, origin: snapshots.get(`${row.originType}:${row.originId}`)! };
  });
  if (!audit) return null;

  // Planos vinculados pertencem à ORIGEM (origin_type + origin_id), não à auditoria — sem FK.
  const { rows: plans } = await listActionPlans(orgId, {
    originType: audit.row.originType as ActionPlanOriginType,
    originId: audit.row.originId,
    pageSize: 100,
  });
  return { audit: audit.row, origin: audit.origin, plans };
}

// ── Create (valida origem + impede 2ª ativa; UNIQUE parcial = backstop) ──────────

export async function createRiskAudit(
  orgId: string,
  values: RiskAuditCreateValues,
): Promise<RiskAudit> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      await assertOriginInTenant(tx, orgId, values.originType, values.originId);

      // Checagem semântica prévia (mensagem clara); a UNIQUE parcial é o backstop concorrente.
      const [active] = await tx
        .select({ id: riskAudits.id })
        .from(riskAudits)
        .where(
          and(
            eq(riskAudits.orgId, orgId),
            eq(riskAudits.originType, values.originType),
            eq(riskAudits.originId, values.originId),
            sql`${riskAudits.status} <> 'completed'`,
          ),
        )
        .limit(1);
      if (active) {
        throw new EntityInUseError("Já existe uma auditoria ativa para esta origem.");
      }

      try {
        const [row] = await tx
          .insert(riskAudits)
          .values({
            orgId,
            originType: values.originType,
            originId: values.originId,
            status: "awaiting_analysis",
          })
          .returning();
        return row;
      } catch (error) {
        // Corrida: outra transação inseriu a auditoria ativa entre o SELECT e o INSERT.
        if (isUniqueViolation(error)) {
          throw new EntityInUseError("Já existe uma auditoria ativa para esta origem.");
        }
        throw error;
      }
    }),
  );
}

// ── Transição (state machine de domínio; timestamps server-side) ─────────────────

export async function transitionRiskAudit(
  orgId: string,
  id: string,
  to: RiskAuditStatus,
  justification: string | null | undefined,
): Promise<RiskAudit | null> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const [current] = await tx
        .select({ status: riskAudits.status })
        .from(riskAudits)
        .where(and(eq(riskAudits.orgId, orgId), eq(riskAudits.id, id)))
        .limit(1);
      if (!current) return null;

      const check = validateRiskAuditTransition(
        current.status as RiskAuditStatus,
        to,
        justification,
      );
      if (!check.ok) {
        throw new ValidationError(
          check.reason === "justification_required"
            ? "Justificativa é obrigatória para concluir a auditoria."
            : "Transição de estado inválida para a auditoria.",
        );
      }

      const now = new Date();
      const [row] = await tx
        .update(riskAudits)
        .set({
          status: to,
          startedAt: to === "planning_actions" ? now : undefined,
          completedAt: to === "completed" ? now : undefined,
          justification: to === "completed" ? (justification?.trim() ?? null) : undefined,
          updatedAt: now,
        })
        .where(and(eq(riskAudits.orgId, orgId), eq(riskAudits.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

/**
 * Contexto **seguro** da origem para a sugestão por IA (allowlist não-PII). Para `risk`, lê
 * campos técnicos do risco + ambiente do GES (títulos de função). Para `incident`, só a versão
 * anônima (nunca `employee`/hospital/lesão/testemunhas). Cross-tenant/inexistente → `null`.
 */
export async function getSuggestionOriginContext(
  orgId: string,
  originType: ActionPlanOriginType,
  originId: string,
): Promise<Record<string, unknown> | null> {
  return withOrg(orgId, async (tx) => {
    if (originType === "risk") {
      const [risk] = await tx
        .select({
          agentType: risks.agentType,
          description: risks.description,
          hazard: risks.hazard,
          sources: risks.sources,
          possibleInjuries: risks.possibleInjuries,
          gesId: risks.gesId,
        })
        .from(risks)
        .where(and(eq(risks.orgId, orgId), eq(risks.id, originId)))
        .limit(1);
      if (!risk) return null;

      const [gesRow] = await tx
        .select({
          gesName: ges.name,
          processDescription: ges.processDescription,
          constructionType: ges.constructionType,
          lighting: ges.lighting,
          ventilation: ges.ventilation,
          otherCharacteristics: ges.otherCharacteristics,
        })
        .from(ges)
        .where(and(eq(ges.orgId, orgId), eq(ges.id, risk.gesId)))
        .limit(1);

      const roleRows = await tx
        .select({ title: jobRoles.title })
        .from(gesJobRoles)
        .innerJoin(
          jobRoles,
          and(eq(jobRoles.id, gesJobRoles.jobRoleId), eq(jobRoles.orgId, orgId)),
        )
        .where(and(eq(gesJobRoles.orgId, orgId), eq(gesJobRoles.gesId, risk.gesId)));

      const environment = [
        gesRow?.constructionType,
        gesRow?.lighting,
        gesRow?.ventilation,
        gesRow?.otherCharacteristics,
      ]
        .filter((v): v is string => !!v && v.trim() !== "")
        .join("; ");

      return {
        kind: "risk",
        agentType: risk.agentType,
        description: risk.description,
        hazard: risk.hazard,
        sources: risk.sources,
        possibleInjuries: risk.possibleInjuries,
        gesName: gesRow?.gesName,
        processDescription: gesRow?.processDescription,
        environment: environment || undefined,
        roleTitles: roleRows.map((r) => r.title),
      };
    }

    // incident → só colunas da allowlist (NUNCA employee/hospital/lesão/testemunhas/CAT).
    const [row] = await tx
      .select({
        type: accidents.type,
        category: accidents.category,
        severity: accidents.severity,
        location: accidents.location,
        description: accidents.description,
        causes: accidents.causes,
        activityProcedure: accidents.activityProcedure,
        responsibleArea: accidents.responsibleArea,
        environmentalImpact: accidents.environmentalImpact,
        materialLoss: accidents.materialLoss,
      })
      .from(accidents)
      .where(and(eq(accidents.orgId, orgId), eq(accidents.id, originId)))
      .limit(1);
    if (!row) return null;
    return { kind: "incident", ...row };
  });
}
