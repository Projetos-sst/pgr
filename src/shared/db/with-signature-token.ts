import "server-only";

import { sql } from "drizzle-orm";

import { hashToken } from "@/shared/domains/signatures/token";

import { db } from "./index";
import type { TenantTransaction } from "./with-org";

/**
 * Fixa o token (hasheado) na transação via `set_config('app.signature_token', …)`,
 * habilitando a **policy de capability** de `signature_requests` a ler somente a
 * única linha cujo token o cliente possui — sem tenant ambiente e sem
 * `SECURITY DEFINER`. Espelha `withOrg`; o escopo transacional impede vazamento no
 * pool. Para gravar, derive `org_id` da linha lida e use `withOrg(orgId, …)`.
 */
export async function withSignatureToken<T>(
  rawToken: string,
  fn: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  const tokenHash = hashToken(rawToken);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.signature_token', ${tokenHash}, true)`);
    return fn(tx);
  });
}
