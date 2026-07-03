"use server";

import { requireAuth } from "@/shared/auth/require-auth";
import { lookupCaRecord } from "@/shared/integrations/caepi/lookup";
import { isValidCa, normalizeCa } from "@/shared/integrations/caepi/normalize";
import type { CaLookupResult } from "@/shared/integrations/caepi/types";
import { toActionError } from "@/shared/server/action-error";
import { ok, fail, type ActionResult } from "@/shared/server/result";

/**
 * Consulta de CA no espelho local do CAEPI. Gate = só sessão (`requireAuth()`,
 * decisão de Clarifications — dado público, sem tenant/papel; `officeAction` não
 * serve aqui). Erros conhecidos viram `ActionResult.fail`; inesperados são
 * relançados (padrão officeAction — nunca silenciar).
 */
export async function lookupCa(ca: string): Promise<ActionResult<CaLookupResult>> {
  try {
    await requireAuth();
    if (!isValidCa(ca)) return fail("VALIDATION", "CA inválido.");
    return ok(await lookupCaRecord(normalizeCa(ca)));
  } catch (error) {
    const mapped = toActionError(error);
    if (mapped) return { ok: false, error: mapped };
    throw error;
  }
}
