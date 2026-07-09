export type TenantEventOutcome = "ok" | "blocked" | "rejected";

export type TenantAuditFields = {
  operation: string;
  outcome: TenantEventOutcome;
  requestId?: string;
  orgId?: string | null;
  userId?: string | null;
  /** Mensagem do erro inesperado (sem stack/PII) — sem isso o 500 é indiagnosticável. */
  error?: string;
};

export function logTenantEvent(level: "info" | "error", fields: TenantAuditFields): void {
  const line = JSON.stringify({ level, ...fields });
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}
