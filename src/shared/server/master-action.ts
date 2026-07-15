import "server-only";

import { requireMaster, type MasterContext } from "@/shared/auth/require-master";

import { toActionError } from "./action-error";
import { ok, type ActionResult } from "./result";

/**
 * Wrapper de Server Action da área de superadmin: gate `requireMaster` +
 * mapeamento de erro padrão. Espelha `officeAction`, mas com o gate global (não
 * de tenant). Erro inesperado é rethrown (nunca silenciado).
 */
export async function masterAction<T>(
  fn: (ctx: MasterContext) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const ctx = await requireMaster();
    return ok(await fn(ctx));
  } catch (error) {
    const mapped = toActionError(error);
    if (mapped) return { ok: false, error: mapped };
    throw error;
  }
}
