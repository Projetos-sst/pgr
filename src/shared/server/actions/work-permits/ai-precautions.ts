"use server";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { WorkPermitPrecautionsFillInput } from "@/shared/domains/work-permits/ai-precautions-fill";
import {
  runWorkPermitPrecautionsFill,
  type WorkPermitPrecautionsFillResult,
} from "@/shared/server/work-permits/ai-precautions-fill-core";

export async function fillWorkPermitPrecautionsAction(
  input: WorkPermitPrecautionsFillInput,
): Promise<ActionResult<WorkPermitPrecautionsFillResult>> {
  return officeAction(
    "work_permits.precautions.ai_fill",
    (ctx) => runWorkPermitPrecautionsFill(ctx, input),
    { audit: true },
  );
}
