"use server";

import { revalidatePath } from "next/cache";

import * as repo from "@/shared/db/repositories/inspection-plans";
import {
  inspectionPlanInputSchema,
  type InspectionPlanInput,
  type PlanListItem,
  type PlanWithItems,
} from "@/shared/domains/inspections/plans";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";

export async function listPlansAction(
  params: repo.ListPlansParams = {},
): Promise<ActionResult<Paginated<PlanListItem>>> {
  return officeAction("inspections.plans.list", ({ tenantId }) =>
    repo.listPlans(tenantId, params),
  );
}

export async function getPlanAction(id: string): Promise<ActionResult<PlanWithItems>> {
  return officeAction("inspections.plans.get", async ({ tenantId }) => {
    const row = await repo.getPlanWithItems(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createPlanAction(
  input: InspectionPlanInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "inspections.plans.create",
    async ({ tenantId }) => {
      const result = await repo.createPlan(
        tenantId,
        inspectionPlanInputSchema.parse(input),
      );
      revalidatePath("/inspection-plans");
      return result;
    },
    { audit: true },
  );
}

export async function updatePlanAction(
  id: string,
  input: InspectionPlanInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "inspections.plans.update",
    async ({ tenantId }) => {
      const ok = await repo.updatePlan(
        tenantId,
        id,
        inspectionPlanInputSchema.parse(input),
      );
      if (!ok) throw new NotFoundError();
      revalidatePath("/inspection-plans");
      return { id };
    },
    { audit: true },
  );
}

export async function deletePlanAction(
  id: string,
): Promise<ActionResult<{ deleted: true }>> {
  return officeAction(
    "inspections.plans.delete",
    async ({ tenantId }) => {
      const ok = await repo.deletePlan(tenantId, id);
      if (!ok) throw new NotFoundError();
      revalidatePath("/inspection-plans");
      return { deleted: true as const };
    },
    { audit: true },
  );
}
