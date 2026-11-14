import "server-only";

import { sql } from "drizzle-orm";

import { db } from "./index";
import type { TenantTransaction } from "./with-org";

export function withPlatformOperator<T>(
  userId: string,
  fn: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.platform_operator', ${userId}, true)`);
    return fn(tx);
  });
}
