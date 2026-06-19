import "server-only";

import { logTenantEvent } from "@/shared/tenant/audit-log";

export async function auditedTenantWrite<T>(
  orgId: string,
  operation: string,
  write: () => Promise<T>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    logTenantEvent("error", {
      operation,
      outcome: "rejected",
      orgId,
    });
    throw error;
  }
}
