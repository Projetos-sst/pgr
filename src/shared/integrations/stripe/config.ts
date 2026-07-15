import "server-only";

/**
 * Configuração do Stripe — server-only (emenda 1.5.0). Chaves só em env, nunca no
 * cliente. Ausente ⇒ billing desabilitado (a fatia entrega o código; as chaves
 * são provisionadas na Vercel para ir ao ar).
 */
export type StripeConfig = {
  secretKey: string;
  webhookSecret: string | null;
  proPriceId: string | null;
};

export function getStripeConfig(): StripeConfig | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return null;
  return {
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || null,
    proPriceId: process.env.STRIPE_PRICE_ID_PRO?.trim() || null,
  };
}

export function isBillingEnabled(): boolean {
  return getStripeConfig() !== null;
}

/** Base URL para os redirects do Checkout (sucesso/cancelamento). */
export function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000"
  );
}
