"use server";

import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { AcceptSuggestedMeasuresInput } from "@/shared/domains/pgr/ai-control-measure-suggestion";
import {
  runAcceptSuggestedMeasures,
  runSuggestControlMeasures,
  type AcceptSuggestedMeasuresResult,
  type SuggestControlMeasuresResult,
} from "@/shared/server/pgr/ai-control-measure-core";

/**
 * Sugere medidas de controle por IA para um risco (não persiste nada; retorna propostas
 * para revisão). Gate de papel + isolamento + cota + LLM ficam no core compartilhado.
 */
export async function suggestControlMeasures(
  riskId: string,
): Promise<ActionResult<SuggestControlMeasuresResult>> {
  return officeAction(
    "pgr.ai_control_measure.suggest",
    (ctx) => runSuggestControlMeasures(ctx, riskId),
    { audit: true },
  );
}

/**
 * Persiste as medidas selecionadas/revisadas em `control_measures`. Revalida o detalhe do
 * risco, onde as medidas aparecem.
 */
export async function acceptSuggestedControlMeasures(
  riskId: string,
  input: AcceptSuggestedMeasuresInput,
): Promise<ActionResult<AcceptSuggestedMeasuresResult>> {
  return officeAction(
    "pgr.ai_control_measure.accept",
    async (ctx) => {
      const result = await runAcceptSuggestedMeasures(ctx, riskId, input);
      revalidatePath(`/risks/${riskId}`);
      revalidatePath(`/risks/${riskId}/control-measures`);
      return result;
    },
    { audit: true },
  );
}
