"use server";

import { toActionError } from "@/shared/server/action-error";
import { fail, ok, type ActionResult } from "@/shared/server/result";
import {
  submitResponseSchema,
  type SubmitResponseInput,
} from "@/shared/domains/psychosocial/responses";
import * as repo from "@/shared/db/repositories/psychosocial-campaigns";
import type { PublicResolution } from "@/shared/db/repositories/psychosocial-campaigns";

/**
 * Resolve a campanha pública por (campaignId, token) — usado pela página anônima.
 * Devolve o estado (`ok`/`invalid`/`not_open`) sem exigir sessão.
 */
export async function loadPublicPsychosocialCampaign(
  campaignId: string,
  token: string,
): Promise<PublicResolution> {
  return repo.resolvePublicCampaign(campaignId, token);
}

/**
 * Superfície pública (SEM gate de office staff): responder o questionário
 * psicossocial de forma anônima. O tenant é derivado do token da campanha
 * (policy de capability), nunca do cliente. Estados "invalid"/"not_open" viram
 * códigos para a página renderizar mensagem amigável.
 */
export async function submitPsychosocialResponse(
  campaignId: string,
  token: string,
  input: SubmitResponseInput,
): Promise<ActionResult<void>> {
  try {
    const data = submitResponseSchema.parse(input);
    const result = await repo.submitPublicResponse(campaignId, token, data);
    if (result.kind === "invalid") return fail("NOT_FOUND", "Link inválido.");
    if (result.kind === "not_open") {
      return fail("VALIDATION", "Campanha encerrada ou fora do período.");
    }
    return ok(undefined);
  } catch (error) {
    const mapped = toActionError(error);
    if (mapped) return { ok: false, error: mapped };
    throw error;
  }
}
