export type TenantEventOutcome = "ok" | "blocked" | "rejected";

export type TenantAuditFields = {
  operation: string;
  outcome: TenantEventOutcome;
  requestId?: string;
  orgId?: string | null;
  userId?: string | null;
  /** Mensagem do erro inesperado (sem stack/PII) — sem isso o 500 é indiagnosticável. */
  error?: string;
  /**
   * Condição concreta por trás do `outcome` (ex.: `no_membership` vs
   * `lost_access` num bloqueio). Sem isso, dois estados muito diferentes ficam
   * indistinguíveis no log. Identificador fixo, nunca texto livre com PII.
   */
  reason?: string;
};

export function logTenantEvent(level: "info" | "error", fields: TenantAuditFields): void {
  const line = JSON.stringify({ level, ...fields });
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}
