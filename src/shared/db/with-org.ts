import "server-only";

import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { db } from "./index";
import * as schema from "./schema";

export type TenantTransaction = Parameters<
  Parameters<PostgresJsDatabase<typeof schema>["transaction"]>[0]
>[0];

export async function withOrg<T>(
  orgId: string,
  fn: (tx: TenantTransaction) => Promise<T>,
  options?: Parameters<typeof db.transaction>[1],
): Promise<T> {
  const run = async (tx: TenantTransaction) => {
    await tx.execute(sql`select set_config('app.current_org', ${orgId}, true)`);
    return fn(tx);
  };
  return options ? db.transaction(run, options) : db.transaction(run);
}
