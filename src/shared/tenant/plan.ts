import type { Plan } from "./active-tenant";

export function isTeamManagementAvailable(plan: Plan): boolean {
  return plan === "pro";
}

/** Quota mensal de pedidos de assinatura no plano free (pro é ilimitado). */
export const FREE_SIGNATURE_MONTHLY_QUOTA = 10;

/**
 * Disponibilidade de criação de pedido de assinatura para o plano do tenant ativo
 * (Inv-1). `pro` é sempre disponível; `free` permite até
 * `FREE_SIGNATURE_MONTHLY_QUOTA` pedidos no mês corrente.
 */
export function isSignatureAvailable(plan: Plan, currentMonthCount: number): boolean {
  if (plan === "pro") return true;
  return currentMonthCount < FREE_SIGNATURE_MONTHLY_QUOTA;
}
