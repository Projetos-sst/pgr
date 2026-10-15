"use server";

import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { AcceptSuggestedTrainingsInput } from "@/shared/domains/pgr/ai-training-suggestion";
import {
  runAcceptSuggestedTrainings,
  runSuggestRequiredTrainings,
  type AcceptSuggestedTrainingsResult,
  type SuggestRequiredTrainingsResult,
} from "@/shared/server/pgr/ai-required-training-core";

/**
 * Sugere os treinamentos obrigatórios de uma função por IA (não persiste nada; devolve as
 * propostas já confrontadas com o catálogo da organização).
 */
export async function suggestRequiredTrainings(
  jobRoleId: string,
): Promise<ActionResult<SuggestRequiredTrainingsResult>> {
  return officeAction(
    "pgr.ai_required_training.suggest",
    (ctx) => runSuggestRequiredTrainings(ctx, jobRoleId),
    { audit: true },
  );
}

/**
 * Vincula os treinamentos aceitos à função, criando no catálogo os que ainda não existem.
 * Revalida a edição da função, onde os obrigatórios aparecem.
 */
export async function acceptSuggestedTrainings(
  jobRoleId: string,
  input: AcceptSuggestedTrainingsInput,
): Promise<ActionResult<AcceptSuggestedTrainingsResult>> {
  return officeAction(
    "pgr.ai_required_training.accept",
    async (ctx) => {
      const result = await runAcceptSuggestedTrainings(ctx, jobRoleId, input);
      revalidatePath(`/job-roles/${jobRoleId}/edit`);
      revalidatePath("/training-catalog");
      return result;
    },
    { audit: true },
  );
}
