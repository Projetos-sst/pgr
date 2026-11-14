import "server-only";

import type Stripe from "stripe";

import { ForbiddenError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as orgsRepo from "@/shared/db/repositories/orgs";
import {
  TRIAL_DAYS,
  planFromSubscriptionStatus,
} from "@/shared/domains/platform/billing";
import { BillingUnavailableError } from "@/shared/errors/billing-unavailable-error";
import {
  createBillingPortalSession,
  createProCheckoutSession,
} from "@/shared/integrations/stripe/client";
import { getAppBaseUrl } from "@/shared/integrations/stripe/config";
import { handleCommercialStripeEvent } from "@/shared/server/commercial/commercial-webhook";

/** Inicia o Checkout do plano Pro. Só o `owner` gerencia a assinatura. */
export async function startProCheckout(ctx: TenantContext): Promise<{ url: string }> {
  if (ctx.role !== "owner") {
    throw new ForbiddenError("Apenas o administrador gerencia a assinatura.");
  }
  const org = await orgsRepo.getOrgById(ctx.tenantId);
  const base = getAppBaseUrl();
  const { url } = await createProCheckoutSession({
    orgId: ctx.tenantId,
    customerId: org?.stripeCustomerId ?? null,
    trialDays: TRIAL_DAYS,
    successUrl: `${base}/plans?status=success`,
    cancelUrl: `${base}/plans?status=cancelled`,
  });
  if (!url) throw new BillingUnavailableError();
  return { url };
}

/**
 * Abre o Portal de Billing hospedado (gerenciar cartão, ver faturas, cancelar a
 * assinatura). Só o `owner` gerencia; exige assinatura já iniciada (customer do
 * Stripe existente) — sem checkout prévio não há o que gerenciar.
 */
export async function openBillingPortal(ctx: TenantContext): Promise<{ url: string }> {
  if (ctx.role !== "owner") {
    throw new ForbiddenError("Apenas o administrador gerencia a assinatura.");
  }
  const org = await orgsRepo.getOrgById(ctx.tenantId);
  if (!org?.stripeCustomerId) throw new BillingUnavailableError();
  const base = getAppBaseUrl();
  return createBillingPortalSession({
    customerId: org.stripeCustomerId,
    returnUrl: `${base}/plans`,
  });
}

function orgIdFromMetadata(metadata: Stripe.Metadata | null | undefined): string | null {
  return metadata?.orgId ?? null;
}

/**
 * Sincroniza o plano local a partir de um evento do Stripe (já com assinatura
 * verificada). O Stripe é a fonte da verdade; `orgs.plan` é o espelho.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (await handleCommercialStripeEvent(event)) return;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "payment") return;
    const orgId = orgIdFromMetadata(session.metadata) ?? session.client_reference_id;
    if (!orgId) return;
    await orgsRepo.updateOrgBilling(orgId, {
      plan: "pro",
      stripeCustomerId:
        typeof session.customer === "string" ? session.customer : undefined,
      stripeSubscriptionId:
        typeof session.subscription === "string" ? session.subscription : undefined,
    });
    return;
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === "string" ? sub.customer : null;
    let orgId = orgIdFromMetadata(sub.metadata);
    if (!orgId && customerId) {
      orgId = (await orgsRepo.getOrgByStripeCustomerId(customerId))?.id ?? null;
    }
    if (!orgId) return;
    await orgsRepo.updateOrgBilling(orgId, {
      plan: planFromSubscriptionStatus(sub.status),
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: sub.id,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    });
  }
}
