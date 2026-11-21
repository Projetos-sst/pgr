"use server";

import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { AcceptEpiRiskFillInput } from "@/shared/domains/pgr/ai-epi-risk-fill";
import {
  runAcceptEpiRiskFill,
  runEpiRiskFill,
  type AcceptEpiRiskFillResult,
  type EpiRiskFillResult,
} from "@/shared/server/pgr/ai-epi-risk-fill-core";

const editPath = (riskId: string) => `/risks/${riskId}/edit`;

export async function fillRiskEpisAction(
  riskId: string,
): Promise<ActionResult<EpiRiskFillResult>> {
  return officeAction("pgr.epi_risk.ai_fill", (ctx) => runEpiRiskFill(ctx, riskId), {
    audit: true,
  });
}

export async function acceptRiskEpiFillAction(
  riskId: string,
  input: AcceptEpiRiskFillInput,
): Promise<ActionResult<AcceptEpiRiskFillResult>> {
  return officeAction(
    "pgr.epi_risk.ai_fill_accept",
    async (ctx) => {
      const result = await runAcceptEpiRiskFill(ctx, riskId, input);
      revalidatePath(editPath(riskId));
      return result;
    },
    { audit: true },
  );
}
