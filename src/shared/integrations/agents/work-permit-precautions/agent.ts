import {
  parseModelPrecautions,
  type WorkPermitPrecautionsContext,
} from "@/shared/domains/work-permits/ai-precautions-fill";

import { SstAgent } from "../core/sst-agent";
import {
  WORK_PERMIT_PRECAUTIONS_INSTRUCTIONS,
  buildWorkPermitPrecautionsPrompt,
  workPermitPrecautionsOutputSchema,
  type WorkPermitPrecautionsOutput,
} from "./prompt";

export class WorkPermitPrecautionsAgent extends SstAgent<
  WorkPermitPrecautionsContext,
  WorkPermitPrecautionsOutput,
  string[]
> {
  readonly id = "work-permit-precautions";
  readonly name = "Preenchimento das precauções da permissão de trabalho";
  readonly instructions = WORK_PERMIT_PRECAUTIONS_INSTRUCTIONS;
  readonly outputSchema = workPermitPrecautionsOutputSchema;
  readonly maxOutputTokens = 2048;
  readonly timeoutMs = 60_000;

  buildPrompt(ctx: WorkPermitPrecautionsContext): string {
    return buildWorkPermitPrecautionsPrompt(ctx);
  }

  parseOutput(raw: WorkPermitPrecautionsOutput): string[] {
    return parseModelPrecautions(raw);
  }
}

export const workPermitPrecautionsAgent = new WorkPermitPrecautionsAgent();
