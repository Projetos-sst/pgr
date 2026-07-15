import "server-only";

import Stripe from "stripe";

import { BillingUnavailableError } from "@/shared/errors/billing-unavailable-error";

import { getStripeConfig } from "./config";

/**
 * Ponto ÚNICO de rede do Stripe. Cliente construído a partir do segredo server-only.
 * Serviço ausente ⇒ `BillingUnavailableError` (503). O cartão nunca toca a aplicação:
 * usamos Checkout hospedado (PCI SAQ-A).
 */
function stripeClient(): Stripe {
  const config = getStripeConfig();
  if (!config) throw new BillingUnavailableError();
  return new Stripe(config.secretKey);
}

export async function createProCheckoutSession(args: {
  orgId: string;
  customerId: string | null;
  trialDays: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string | null }> {
  const config = getStripeConfig();
  if (!config?.proPriceId) throw new BillingUnavailableError();

  const session = await stripeClient().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: config.proPriceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: args.trialDays,
      metadata: { orgId: args.orgId },
    },
    metadata: { orgId: args.orgId },
    client_reference_id: args.orgId,
    ...(args.customerId ? { customer: args.customerId } : {}),
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
  });

  return { url: session.url };
}

/** Verifica a assinatura do webhook e devolve o evento tipado. */
export function constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  const config = getStripeConfig();
  if (!config?.webhookSecret) throw new BillingUnavailableError();
  return stripeClient().webhooks.constructEvent(payload, signature, config.webhookSecret);
}
