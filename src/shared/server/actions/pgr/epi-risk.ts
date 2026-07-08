"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  epiRiskLinkInputSchema,
  epiRiskLinkUpdateSchema,
  type EpiOption,
  type EpiRiskLinkInput,
  type EpiRiskLinkItem,
  type EpiRiskLinkUpdateInput,
} from "@/shared/domains/pgr/epi-risk";
import * as linkRepo from "@/shared/db/repositories/epi-risk";

const editPath = (riskId: string) => `/risks/${riskId}/edit`;

export async function listRiskEpisAction(
  riskId: string,
): Promise<ActionResult<EpiRiskLinkItem[]>> {
  return officeAction("pgr.epi_risk.list", ({ tenantId }) =>
    linkRepo.listRiskEpis(tenantId, { riskId }),
  );
}

export async function listAvailableEpisForRiskAction(
  riskId: string,
  search?: string,
): Promise<ActionResult<EpiOption[]>> {
  return officeAction("pgr.epi_risk.available", ({ tenantId }) =>
    linkRepo.listAvailableEpisForRisk(tenantId, riskId, { search }),
  );
}

export async function addRiskEpiAction(
  input: EpiRiskLinkInput,
): Promise<ActionResult<{ riskId: string }>> {
  return officeAction(
    "pgr.epi_risk.add",
    async ({ tenantId }) => {
      const data = epiRiskLinkInputSchema.parse(input);
      await linkRepo.createRiskEpi(tenantId, data);
      revalidatePath(editPath(data.riskId));
      return { riskId: data.riskId };
    },
    { audit: true },
  );
}

export async function updateRiskEpiAction(
  id: string,
  riskId: string,
  input: EpiRiskLinkUpdateInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.epi_risk.update",
    async ({ tenantId }) => {
      const data = epiRiskLinkUpdateSchema.parse(input);
      const row = await linkRepo.updateRiskEpiNeutralization(tenantId, id, data);
      if (!row) throw new NotFoundError();
      revalidatePath(editPath(riskId));
      return { id };
    },
    { audit: true },
  );
}

export async function removeRiskEpiAction(
  id: string,
  riskId: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.epi_risk.remove",
    async ({ tenantId }) => {
      const deleted = await linkRepo.deleteRiskEpi(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(editPath(riskId));
      return { id };
    },
    { audit: true },
  );
}
