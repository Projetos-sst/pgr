"use server";

import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type {
  AcceptSuggestedRisksInput,
  RiskFillFocusInput,
} from "@/shared/domains/pgr/ai-risk-suggestion";
import {
  runAcceptSuggestedRisks,
  runFillRisk,
  runSuggestRisks,
  type AcceptSuggestedRisksResult,
  type FillRiskResult,
  type SuggestRisksResult,
} from "@/shared/server/pgr/ai-risk-suggestion-core";

const RISKS_PATH = "/risks";

/**
 * US1 — Sugere riscos por IA para um GES (não persiste nada; retorna rascunhos para
 * revisão). Gate de papel + isolamento + cota + LLM ficam no core compartilhado.
 */
export async function suggestRisks(
  gesId: string,
): Promise<ActionResult<SuggestRisksResult>> {
  return officeAction(
    "pgr.ai_risk_suggestion.suggest",
    (ctx) => runSuggestRisks(ctx, gesId),
    { audit: true },
  );
}

export async function fillRisk(
  gesId: string,
  focus: RiskFillFocusInput,
): Promise<ActionResult<FillRiskResult>> {
  return officeAction(
    "pgr.ai_risk_suggestion.fill",
    (ctx) => runFillRisk(ctx, gesId, focus),
    {
      audit: true,
    },
  );
}

/**
 * US1 — Persiste as sugestões selecionadas/revisadas como rascunhos em `risks`
 * (reusa `createRisk`). Revalida a listagem de riscos após inserir.
 */
export async function acceptSuggestedRisks(
  gesId: string,
  input: AcceptSuggestedRisksInput,
): Promise<ActionResult<AcceptSuggestedRisksResult>> {
  return officeAction(
    "pgr.ai_risk_suggestion.accept",
    async (ctx) => {
      const result = await runAcceptSuggestedRisks(ctx, gesId, input);
      revalidatePath(RISKS_PATH);
      return result;
    },
    { audit: true },
  );
}
