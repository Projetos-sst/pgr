import "server-only";

import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { db } from "./index";
import * as schema from "./schema";
import { isBillingSimulationEnabled } from "@/shared/domains/billing/contracts";

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
    if (
      isBillingSimulationEnabled({
        APP_ENV: process.env.APP_ENV,
        BILLING_MODE: process.env.BILLING_MODE,
        BILLING_MOCK_ENABLED: process.env.BILLING_MOCK_ENABLED,
      })
    )
      await tx.execute(sql`select set_config('app.billing_simulation','true',true)`);
    return fn(tx);
  };
  return options ? db.transaction(run, options) : db.transaction(run);
}
