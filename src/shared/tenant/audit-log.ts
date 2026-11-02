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

/**
 * Mensagem de erro inesperado pronta para log, sem os valores da query: o erro
 * do Drizzle é `Failed query: <sql>\nparams: <valores>`, e os valores podem ser
 * texto livre do usuário (ex.: observações de um exame). Mantém o SQL (com `$1`…)
 * para o 500 continuar diagnosticável.
 */
export function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const paramsAt = message.indexOf("\nparams:");
  return paramsAt === -1 ? message : `${message.slice(0, paramsAt)}\nparams: [omitidos]`;
}
