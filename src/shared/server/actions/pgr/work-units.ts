"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  workUnitInputSchema,
  type WorkUnitInput,
  type WorkUnitListItem,
} from "@/shared/domains/pgr/work-units";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/work-units";
import type { WorkUnit } from "@/shared/db/schema/work-units";

const BASE_PATH = "/work-units";

export async function listWorkUnitsAction(
  params: repo.ListWorkUnitsParams = {},
): Promise<ActionResult<Paginated<WorkUnitListItem>>> {
  return officeAction("pgr.work_units.list", ({ tenantId }) =>
    repo.listWorkUnits(tenantId, params),
  );
}

export async function getWorkUnitAction(id: string): Promise<ActionResult<WorkUnit>> {
  return officeAction("pgr.work_units.get", async ({ tenantId }) => {
    const row = await repo.getWorkUnitById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createWorkUnitAction(
  input: WorkUnitInput,
): Promise<ActionResult<WorkUnit>> {
  return officeAction(
    "pgr.work_units.create",
    async ({ tenantId }) => {
      const data = workUnitInputSchema.parse(input);
      const row = await repo.createWorkUnit(tenantId, data);
      revalidatePath(BASE_PATH);
      return row;
    },
    { audit: true },
  );
}

export async function updateWorkUnitAction(
  id: string,
  input: WorkUnitInput,
): Promise<ActionResult<WorkUnit>> {
  return officeAction(
    "pgr.work_units.update",
    async ({ tenantId }) => {
      const data = workUnitInputSchema.parse(input);
      const row = await repo.updateWorkUnit(tenantId, id, data);
      if (!row) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}/edit`);
      return row;
    },
    { audit: true },
  );
}

export async function deleteWorkUnitAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.work_units.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteWorkUnit(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}

export async function getWorkUnitDependentsAction(
  id: string,
): Promise<ActionResult<{ ges: number }>> {
  return officeAction("pgr.work_units.dependents", ({ tenantId }) =>
    repo.countWorkUnitDependents(tenantId, id),
  );
}
