"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";
import {
  riskInputSchema,
  type RiskInput,
  type RiskListItem,
} from "@/shared/domains/pgr/risk";
import * as repo from "@/shared/db/repositories/risks";
import type { Risk } from "@/shared/db/schema/risks";

const BASE_PATH = "/risks";

export async function listRisksAction(
  params: repo.ListRisksParams = {},
): Promise<ActionResult<Paginated<RiskListItem>>> {
  return officeAction("pgr.risks.list", ({ tenantId }) =>
    repo.listRisks(tenantId, params),
  );
}

export async function getRiskAction(id: string): Promise<ActionResult<Risk>> {
  return officeAction("pgr.risks.get", async ({ tenantId }) => {
    const row = await repo.getRiskById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createRiskAction(input: RiskInput): Promise<ActionResult<Risk>> {
  return officeAction(
    "pgr.risks.create",
    async ({ tenantId }) => {
      const values = riskInputSchema.parse(input);
      const row = await repo.createRisk(tenantId, values);
      revalidatePath(BASE_PATH);
      return row;
    },
    { audit: true },
  );
}

export async function updateRiskAction(
  id: string,
  input: RiskInput,
): Promise<ActionResult<Risk>> {
  return officeAction(
    "pgr.risks.update",
    async ({ tenantId }) => {
      const values = riskInputSchema.parse(input);
      const row = await repo.updateRisk(tenantId, id, values);
      if (!row) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}`);
      revalidatePath(`${BASE_PATH}/${id}/edit`);
      return row;
    },
    { audit: true },
  );
}

export async function deleteRiskAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.risks.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteRisk(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}
