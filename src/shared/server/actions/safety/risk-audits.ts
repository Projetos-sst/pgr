"use server";

import { revalidatePath } from "next/cache";

import * as repo from "@/shared/db/repositories/risk-audits";
import { listRisks } from "@/shared/db/repositories/risks";
import { listAccidents } from "@/shared/db/repositories/accidents";
import {
  riskAuditCreateSchema,
  riskAuditFiltersSchema,
  riskAuditStatusTransitionSchema,
  type RiskAudit,
  type RiskAuditCreateInput,
  type RiskAuditDetail,
  type RiskAuditFilters,
  type RiskAuditListItem,
  type RiskAuditStatusTransitionInput,
} from "@/shared/domains/safety/risk-audit";
import { accidentTypeLabel } from "@/shared/domains/safety/accident";
import type { ActionPlanOriginType } from "@/shared/domains/safety/action-plan-origin";
import {
  runSuggestActionPlan,
  type SuggestActionPlanResult,
} from "@/shared/server/safety/action-plan-suggestion-core";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";

const BASE = "/risk-audits";

export type OriginOption = { value: string; label: string };

/** Riscos do tenant como origens selecionáveis (rótulo = descrição do risco). */
export async function listRiskAuditRiskOptionsAction(): Promise<
  ActionResult<OriginOption[]>
> {
  return officeAction("safety.risk_audits.risk_options", async ({ tenantId }) => {
    const { rows } = await listRisks(tenantId, { pageSize: 100 });
    return rows.map((r) => ({ value: r.id, label: r.description }));
  });
}

/** Incidentes do tenant como origens (rótulo **seguro**: tipo + data; sem dado médico). */
export async function listRiskAuditIncidentOptionsAction(): Promise<
  ActionResult<OriginOption[]>
> {
  return officeAction("safety.risk_audits.incident_options", async ({ tenantId }) => {
    const { rows } = await listAccidents(tenantId, { pageSize: 100 });
    return rows.map((a) => ({
      value: a.id,
      label: `${accidentTypeLabel(a.type)} — ${a.occurredAt.slice(0, 10)}`,
    }));
  });
}

export async function listRiskAuditsAction(
  input: RiskAuditFilters = {},
): Promise<ActionResult<Paginated<RiskAuditListItem>>> {
  return officeAction("safety.risk_audits.list", ({ tenantId }) =>
    repo.listRiskAudits(tenantId, riskAuditFiltersSchema.parse(input)),
  );
}

export async function getRiskAuditAction(
  id: string,
): Promise<ActionResult<RiskAuditDetail>> {
  return officeAction("safety.risk_audits.get", async ({ tenantId }) => {
    const row = await repo.getRiskAudit(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

/** Revalida `/risk-audits` e, quando a origem é incidente, seu detalhe (contexto de gestão). */
function revalidateForAudit(audit: { originType: string; originId: string } | null) {
  revalidatePath(BASE);
  if (audit?.originType === "incident") {
    revalidatePath(`/incidents/${audit.originId}`);
  }
}

export async function createRiskAuditAction(
  input: RiskAuditCreateInput,
): Promise<ActionResult<RiskAudit>> {
  return officeAction(
    "safety.risk_audits.create",
    async ({ tenantId }) => {
      const audit = await repo.createRiskAudit(
        tenantId,
        riskAuditCreateSchema.parse(input),
      );
      revalidateForAudit(audit);
      return audit;
    },
    { audit: true },
  );
}

export async function setRiskAuditStatusAction(
  id: string,
  input: RiskAuditStatusTransitionInput,
): Promise<ActionResult<RiskAudit>> {
  return officeAction(
    "safety.risk_audits.set_status",
    async ({ tenantId }) => {
      const { status, justification } = riskAuditStatusTransitionSchema.parse(input);
      const audit = await repo.transitionRiskAudit(tenantId, id, status, justification);
      if (!audit) throw new NotFoundError();
      revalidateForAudit(audit);
      revalidatePath(`${BASE}/${id}`);
      return audit;
    },
    { audit: true },
  );
}

/**
 * Sugestão 5W2H por IA para a origem da auditoria. **Não persiste plano** — só retorna os
 * campos para preencher o formulário de criação (o usuário confirma pelo fluxo normal). Não
 * registra prompt/resposta/PII em audit; a falha da IA é `AI_UNAVAILABLE` sem tocar a auditoria.
 */
export async function suggestActionPlanAction(
  originType: ActionPlanOriginType,
  originId: string,
): Promise<ActionResult<SuggestActionPlanResult>> {
  return officeAction(
    "safety.risk_audits.suggest_action_plan",
    (ctx) => runSuggestActionPlan(ctx, originType, originId),
    { audit: true },
  );
}
