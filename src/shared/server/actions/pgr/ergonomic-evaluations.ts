"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";
import {
  ergonomicEvaluationInputSchema,
  type ErgonomicEvaluationInput,
} from "@/shared/domains/pgr/ergonomics";
import * as repo from "@/shared/db/repositories/ergonomic-evaluations";
import type { ErgonomicEvaluation } from "@/shared/db/schema/ergonomics";

/**
 * Server Actions da avaliação ergonômica NR-17 (issue #40). Espelhadas pelo REST em
 * `/api/v1/risks/{id}/ergonomic-evaluations` e `/api/v1/ergonomic-evaluations/{id}`
 * — mesma validação, mesmo repositório, mesmos códigos de erro.
 */

const basePath = (riskId: string) => `/risks/${riskId}/ergonomic-evaluations`;

function revalidateEvaluation(riskId: string, evaluationId?: string) {
  revalidatePath(`/risks/${riskId}`);
  revalidatePath(basePath(riskId));
  revalidatePath(`${basePath(riskId)}/new`);
  if (evaluationId) revalidatePath(`${basePath(riskId)}/${evaluationId}/edit`);
}

export async function listErgonomicEvaluationsAction(
  riskId: string,
  params: repo.ListErgonomicEvaluationsParams = {},
): Promise<ActionResult<Paginated<ErgonomicEvaluation>>> {
  return officeAction("pgr.ergonomic_evaluations.list", ({ tenantId }) =>
    repo.listErgonomicEvaluations(tenantId, riskId, params),
  );
}

export async function getErgonomicEvaluationAction(
  id: string,
): Promise<ActionResult<ErgonomicEvaluation>> {
  return officeAction("pgr.ergonomic_evaluations.get", async ({ tenantId }) => {
    const row = await repo.getErgonomicEvaluationById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function getCurrentErgonomicEvaluationAction(
  riskId: string,
): Promise<ActionResult<ErgonomicEvaluation | null>> {
  return officeAction("pgr.ergonomic_evaluations.current", ({ tenantId }) =>
    repo.getCurrentErgonomicEvaluation(tenantId, riskId),
  );
}

/** Campanhas psicossociais encerradas da mesma unidade do GES do risco. */
export async function listLinkableCampaignsAction(
  riskId: string,
): Promise<
  ActionResult<
    { id: string; name: string; startsAt: string | null; endsAt: string | null }[]
  >
> {
  return officeAction("pgr.ergonomic_evaluations.campaigns", ({ tenantId }) =>
    repo.listLinkableCampaignsForRisk(tenantId, riskId),
  );
}

export async function createErgonomicEvaluationAction(
  riskId: string,
  input: ErgonomicEvaluationInput,
): Promise<ActionResult<ErgonomicEvaluation>> {
  return officeAction(
    "pgr.ergonomic_evaluations.create",
    async ({ tenantId }) => {
      const values = ergonomicEvaluationInputSchema.parse(input);
      const row = await repo.createErgonomicEvaluation(tenantId, riskId, values);
      revalidateEvaluation(riskId);
      return row;
    },
    { audit: true },
  );
}

export async function updateErgonomicEvaluationAction(
  riskId: string,
  id: string,
  input: ErgonomicEvaluationInput,
): Promise<ActionResult<ErgonomicEvaluation>> {
  return officeAction(
    "pgr.ergonomic_evaluations.update",
    async ({ tenantId }) => {
      const values = ergonomicEvaluationInputSchema.parse(input);
      const row = await repo.updateErgonomicEvaluation(tenantId, id, values);
      if (!row) throw new NotFoundError();
      revalidateEvaluation(riskId, id);
      return row;
    },
    { audit: true },
  );
}

export async function deleteErgonomicEvaluationAction(
  riskId: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.ergonomic_evaluations.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteErgonomicEvaluation(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidateEvaluation(riskId);
      return { id };
    },
    { audit: true },
  );
}
