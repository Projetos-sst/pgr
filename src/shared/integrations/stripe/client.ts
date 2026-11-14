import "server-only";

import Stripe from "stripe";

import { BillingUnavailableError } from "@/shared/errors/billing-unavailable-error";

import { CHECKOUT_REFERENCE_KEY } from "@/shared/domains/commercial/checkout";

import { getStripeConfig, isStripeTestMode } from "./config";

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

export type CommercialCheckoutRequest = {
  checkoutId: string;
  lines: readonly { providerPriceId: string; quantity: number }[];
  providerCustomerId: string | null;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  mode?: "payment";
};

export async function createCommercialCheckoutSession(
  request: CommercialCheckoutRequest,
): Promise<{ id: string; url: string; expiresAt: Date }> {
  const config = getStripeConfig();
  if (!config || !isStripeTestMode(config)) throw new BillingUnavailableError();
  const reference = { [CHECKOUT_REFERENCE_KEY]: request.checkoutId };
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: request.mode ?? "subscription",
    line_items: request.lines.map((line) => ({
      price: line.providerPriceId,
      quantity: line.quantity,
    })),
    ...(request.mode === "payment" ? {} : { subscription_data: { metadata: reference } }),
    metadata: reference,
    client_reference_id: request.checkoutId,
    ...(request.providerCustomerId
      ? { customer: request.providerCustomerId }
      : { customer_email: request.customerEmail }),
    success_url: request.successUrl,
    cancel_url: request.cancelUrl,
  };
  const session = await stripeClient().checkout.sessions.create(params, {
    idempotencyKey: `commercial-checkout:${request.checkoutId}`,
  });
  if (!session.url) throw new BillingUnavailableError();
  return {
    id: session.id,
    url: session.url,
    expiresAt: new Date(session.expires_at * 1000),
  };
}

/**
 * Sessão do Portal de Billing hospedado (gerenciar método de pagamento, ver
 * faturas, cancelar a assinatura). Exige um `customerId` já existente — só existe
 * após o primeiro checkout.
 */
export async function createBillingPortalSession(args: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const session = await stripeClient().billingPortal.sessions.create({
    customer: args.customerId,
    return_url: args.returnUrl,
  });
  return { url: session.url };
}

/** Verifica a assinatura do webhook e devolve o evento tipado. */
export function constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  const config = getStripeConfig();
  if (!config?.webhookSecret) throw new BillingUnavailableError();
  return stripeClient().webhooks.constructEvent(payload, signature, config.webhookSecret);
}
