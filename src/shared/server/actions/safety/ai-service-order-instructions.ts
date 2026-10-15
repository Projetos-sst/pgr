"use server";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  runSuggestServiceOrderInstructions,
  type SuggestServiceOrderInstructionsResult,
} from "@/shared/server/safety/ai-service-order-core";

/**
 * Sugere por IA as instruções de segurança de uma OS (NR-01 1.4.1). Não persiste: as
 * instruções entram no formulário e são gravadas pelo fluxo normal de edição da OS.
 */
export async function suggestServiceOrderInstructions(
  serviceOrderId: string,
): Promise<ActionResult<SuggestServiceOrderInstructionsResult>> {
  return officeAction(
    "safety.ai_service_order.suggest",
    (ctx) => runSuggestServiceOrderInstructions(ctx, serviceOrderId),
    { audit: true },
  );
}
