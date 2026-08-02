"use server";

import { revalidatePath } from "next/cache";

import * as repo from "@/shared/db/repositories/action-plans";
import { listAccidents } from "@/shared/db/repositories/accidents";
import { listRisks } from "@/shared/db/repositories/risks";
import {
  actionPlanCreateSchema,
  actionPlanFiltersSchema,
  actionPlanStatusTransitionSchema,
  actionPlanUpdateSchema,
  type ActionPlanCreateInput,
  type ActionPlanDetail,
  type ActionPlanFilters,
  type ActionPlanListItem,
  type ActionPlanStatusTransitionInput,
  type ActionPlanSummary,
  type ActionPlanUpdateInput,
} from "@/shared/domains/safety/action-plan";
import { accidentTypeLabel } from "@/shared/domains/safety/accident";
import type { ActionPlan } from "@/shared/db/schema";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";

const BASE = "/action-plans";

export type OriginOption = { value: string; label: string };

/** Riscos do tenant como origens selecionáveis (rótulo = descrição do risco). */
export async function listRiskOriginOptionsAction(): Promise<
  ActionResult<OriginOption[]>
> {
  return officeAction("safety.action_plans.risk_options", async ({ tenantId }) => {
    const { rows } = await listRisks(tenantId, { pageSize: 100 });
    return rows.map((r) => ({ value: r.id, label: r.description }));
  });
}

/** Incidentes do tenant como origens (rótulo **seguro**: tipo + data; sem dado médico). */
export async function listIncidentOriginOptionsAction(): Promise<
  ActionResult<OriginOption[]>
> {
  return officeAction("safety.action_plans.incident_options", async ({ tenantId }) => {
    const { rows } = await listAccidents(tenantId, { pageSize: 100 });
    return rows.map((a) => ({
      value: a.id,
      label: `${accidentTypeLabel(a.type)} — ${a.occurredAt.slice(0, 10)}`,
    }));
  });
}

export async function listActionPlansAction(
  input: ActionPlanFilters = {},
): Promise<ActionResult<Paginated<ActionPlanListItem>>> {
  return officeAction("safety.action_plans.list", ({ tenantId }) =>
    repo.listActionPlans(tenantId, actionPlanFiltersSchema.parse(input)),
  );
}

export async function getActionPlanSummaryAction(): Promise<
  ActionResult<ActionPlanSummary>
> {
  return officeAction("safety.action_plans.summary", ({ tenantId }) =>
    repo.getActionPlanSummary(tenantId),
  );
}

export async function getActionPlanAction(
  id: string,
): Promise<ActionResult<ActionPlanDetail>> {
  return officeAction("safety.action_plans.get", async ({ tenantId }) => {
    const row = await repo.getActionPlanById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

/** Revalida `/action-plans` e, quando a origem é incidente, o detalhe/lista de incidentes. */
function revalidateForPlan(plan: { originType: string; originId: string } | null) {
  revalidatePath(BASE);
  if (plan?.originType === "incident") {
    revalidatePath("/incidents");
    revalidatePath(`/incidents/${plan.originId}`);
    revalidatePath("/incidents/management");
  }
}

export async function createActionPlanAction(
  input: ActionPlanCreateInput,
): Promise<ActionResult<ActionPlan>> {
  return officeAction(
    "safety.action_plans.create",
    async ({ tenantId }) => {
      const plan = await repo.createActionPlan(
        tenantId,
        actionPlanCreateSchema.parse(input),
      );
      revalidateForPlan(plan);
      return plan;
    },
    { audit: true },
  );
}

export async function updateActionPlanAction(
  id: string,
  input: ActionPlanUpdateInput,
): Promise<ActionResult<ActionPlan>> {
  return officeAction(
    "safety.action_plans.update",
    async ({ tenantId }) => {
      const plan = await repo.updateActionPlan(
        tenantId,
        id,
        actionPlanUpdateSchema.parse(input),
      );
      if (!plan) throw new NotFoundError();
      revalidatePath(BASE);
      revalidatePath(`${BASE}/${id}`);
      return plan;
    },
    { audit: true },
  );
}

export async function setActionPlanStatusAction(
  id: string,
  input: ActionPlanStatusTransitionInput,
): Promise<ActionResult<ActionPlan>> {
  return officeAction(
    "safety.action_plans.set_status",
    async ({ tenantId }) => {
      const { status } = actionPlanStatusTransitionSchema.parse(input);
      const plan = await repo.setActionPlanStatus(tenantId, id, status);
      if (!plan) throw new NotFoundError();
      revalidateForPlan(plan);
      revalidatePath(`${BASE}/${id}`);
      return plan;
    },
    { audit: true },
  );
}

export async function deleteActionPlanAction(
  id: string,
): Promise<ActionResult<{ deleted: true }>> {
  return officeAction(
    "safety.action_plans.delete",
    async ({ tenantId }) => {
      const ok = await repo.deleteActionPlan(tenantId, id);
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { deleted: true as const };
    },
    { audit: true },
  );
}
