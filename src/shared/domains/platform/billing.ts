export type PlanKey = "free" | "pro";

export const TRIAL_DAYS = 7;

export type PlanFeatureRow = {
  label: string;
  free: string;
  pro: string;
};

/** Tabela comparativa de recursos por plano (exibição na página de planos). */
export const PLAN_FEATURES: PlanFeatureRow[] = [
  { label: "Empresas e PGR", free: "✓", pro: "✓" },
  { label: "Módulo de EPI (estoque, entrega, devolução)", free: "✓", pro: "✓" },
  { label: "Treinamentos e vencimentos", free: "✓", pro: "✓" },
  { label: "Dashboard e pendências", free: "✓", pro: "✓" },
  { label: "Sugestão de riscos por IA", free: "20/mês", pro: "Ilimitado" },
  { label: "Assinatura digital (links)", free: "10/mês", pro: "Ilimitado" },
  { label: "Equipe / multiusuário", free: "—", pro: "✓" },
  { label: "Relatórios em PDF", free: "—", pro: "✓" },
];

export const PLAN_LABEL: Record<PlanKey, string> = {
  free: "Gratuito",
  pro: "Pro",
};

/**
 * Deriva o plano local a partir do status da assinatura do Stripe. `active` e
 * `trialing` ⇒ `pro`; qualquer outro (canceled/unpaid/past_due/incomplete...) ⇒
 * `free`. Puro/testável — a fonte da verdade da cobrança é o Stripe; `orgs.plan`
 * é o espelho local sincronizado pelo webhook.
 */
export function planFromSubscriptionStatus(status: string): PlanKey {
  return status === "active" || status === "trialing" ? "pro" : "free";
}
