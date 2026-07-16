import "server-only";

import { sql } from "drizzle-orm";

import { db } from "./index";
import type { TenantTransaction } from "./with-org";

/**
 * Fixa o token público da campanha na transação via
 * `set_config('app.psychosocial_token', …)`, habilitando a **policy de
 * capability** de `psychosocial_campaigns` a ler só a campanha cujo token o
 * cliente possui — sem tenant de ambiente. Espelha `withSignatureToken` (fatia
 * 010). Para ler perguntas / gravar respostas, derive `org_id` da campanha lida
 * e use `withOrg(orgId, …)`.
 */
export async function withPsychosocialToken<T>(
  token: string,
  fn: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.psychosocial_token', ${token}, true)`);
    return fn(tx);
  });
}
