"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";
import {
  controlMeasureInputSchema,
  type ControlMeasureInput,
  type ControlMeasureListItem,
} from "@/shared/domains/pgr/control-measure";
import * as repo from "@/shared/db/repositories/control-measures";
import type { ControlMeasure } from "@/shared/db/schema/risks";

const basePath = (riskId: string) => `/risks/${riskId}/control-measures`;

function revalidateMeasure(riskId: string, measureId?: string) {
  revalidatePath(`/risks/${riskId}`);
  revalidatePath(basePath(riskId));
  revalidatePath(`${basePath(riskId)}/new`);
  if (measureId) revalidatePath(`${basePath(riskId)}/${measureId}/edit`);
}

export async function listControlMeasuresAction(
  riskId: string,
  params: repo.ListControlMeasuresParams = {},
): Promise<ActionResult<Paginated<ControlMeasureListItem>>> {
  return officeAction("pgr.control_measures.list", ({ tenantId }) =>
    repo.listControlMeasures(tenantId, riskId, params),
  );
}

export async function getControlMeasureAction(
  id: string,
): Promise<ActionResult<ControlMeasure>> {
  return officeAction("pgr.control_measures.get", async ({ tenantId }) => {
    const row = await repo.getControlMeasureById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createControlMeasureAction(
  riskId: string,
  input: ControlMeasureInput,
): Promise<ActionResult<ControlMeasure>> {
  return officeAction(
    "pgr.control_measures.create",
    async ({ tenantId }) => {
      const values = controlMeasureInputSchema.parse(input);
      const row = await repo.createControlMeasure(tenantId, riskId, values);
      revalidateMeasure(riskId);
      return row;
    },
    { audit: true },
  );
}

export async function updateControlMeasureAction(
  riskId: string,
  id: string,
  input: ControlMeasureInput,
): Promise<ActionResult<ControlMeasure>> {
  return officeAction(
    "pgr.control_measures.update",
    async ({ tenantId }) => {
      const values = controlMeasureInputSchema.parse(input);
      const row = await repo.updateControlMeasure(tenantId, id, values);
      if (!row) throw new NotFoundError();
      revalidateMeasure(riskId, id);
      return row;
    },
    { audit: true },
  );
}

export async function deleteControlMeasureAction(
  riskId: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.control_measures.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteControlMeasure(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidateMeasure(riskId);
      return { id };
    },
    { audit: true },
  );
}
