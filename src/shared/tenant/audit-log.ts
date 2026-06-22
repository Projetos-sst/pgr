export type TenantEventOutcome = "ok" | "blocked" | "rejected";

export type TenantAuditFields = {
  operation: string;
  outcome: TenantEventOutcome;
  requestId?: string;
  orgId?: string | null;
  userId?: string | null;
};

export function logTenantEvent(level: "info" | "error", fields: TenantAuditFields): void {
  const line = JSON.stringify({ level, ...fields });
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}
