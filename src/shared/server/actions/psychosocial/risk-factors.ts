"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  psychosocialRiskFactorInputSchema,
  type PsychosocialRiskFactorInput,
  type PsychosocialRiskFactorRow,
} from "@/shared/domains/psychosocial/risk-factors";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/psychosocial-risk-factors";
import type { PsychosocialRiskFactor } from "@/shared/db/schema";

const BASE_PATH = "/psychosocial/risk-factors";

export async function listPsychosocialRiskFactorsAction(
  params: repo.ListPsychosocialRiskFactorParams = {},
): Promise<ActionResult<Paginated<PsychosocialRiskFactorRow>>> {
  return officeAction("psychosocial.risk_factors.list", ({ tenantId }) =>
    repo.listPsychosocialRiskFactors(tenantId, params),
  );
}

export async function getPsychosocialRiskFactorAction(
  id: string,
): Promise<ActionResult<PsychosocialRiskFactor>> {
  return officeAction("psychosocial.risk_factors.get", async ({ tenantId }) => {
    const item = await repo.getPsychosocialRiskFactorById(tenantId, id);
    if (!item) throw new NotFoundError();
    return item;
  });
}

export async function createPsychosocialRiskFactorAction(
  input: PsychosocialRiskFactorInput,
): Promise<ActionResult<PsychosocialRiskFactor>> {
  return officeAction(
    "psychosocial.risk_factors.create",
    async ({ tenantId }) => {
      const data = psychosocialRiskFactorInputSchema.parse(input);
      const item = await repo.createPsychosocialRiskFactor(tenantId, data);
      revalidatePath(BASE_PATH);
      return item;
    },
    { audit: true },
  );
}

export async function updatePsychosocialRiskFactorAction(
  id: string,
  input: PsychosocialRiskFactorInput,
): Promise<ActionResult<PsychosocialRiskFactor>> {
  return officeAction(
    "psychosocial.risk_factors.update",
    async ({ tenantId }) => {
      const data = psychosocialRiskFactorInputSchema.parse(input);
      const item = await repo.updatePsychosocialRiskFactor(tenantId, id, data);
      if (!item) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}/edit`);
      return item;
    },
    { audit: true },
  );
}

export async function deletePsychosocialRiskFactorAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "psychosocial.risk_factors.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deletePsychosocialRiskFactor(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}
