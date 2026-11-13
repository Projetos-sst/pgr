import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  BILLING_PROVIDER,
  type BillingEventOutcome,
} from "@/shared/domains/commercial/billing-model";
import {
  entitlementChanges,
  type EntitlementState,
} from "@/shared/domains/commercial/entitlement";
import {
  applyInvoiceSnapshot,
  classifyInvoiceLines,
  withUndetailedRemainder,
} from "@/shared/domains/commercial/invoice";
import type {
  CheckoutCompletedEvent,
  CheckoutExpiredEvent,
  InvoiceEvent,
  InvoiceSnapshot,
  ProviderEvent,
  ProviderEventReference,
  SubscriptionEvent,
} from "@/shared/domains/commercial/provider-event";
import {
  PROVISIONAL_DELINQUENCY_POLICY,
  applySubscriptionSnapshot,
  subscriptionAccess,
  type SubscriptionMirror,
} from "@/shared/domains/commercial/subscription";
import { NotFoundError } from "@/shared/errors/not-found-error";

import { db } from "../index";
import {
  billingCheckoutSessions,
  billingEvents,
  billingInvoiceItems,
  billingInvoices,
  billingProviderCustomers,
  billingProviderPrices,
  billingSubscriptions,
  commercialEntitlements,
} from "../schema/billing";
import { commercialContracts, commercialOfferItems } from "../schema/commercial";
import { withOrg, type TenantTransaction } from "../with-org";

const sessions = billingCheckoutSessions;
const subscriptions = billingSubscriptions;
const entitlements = commercialEntitlements;
const invoices = billingInvoices;
const prices = billingProviderPrices;

const NOT_YET_PAID: EntitlementState = {
  status: "inactive",
  reason: "subscription_incomplete",
};

export type BillingLink = { orgId: string; contractId: string };
export type EventResult = { outcome: BillingEventOutcome; detail: string };
export type EventContext = { tx: TenantTransaction; link: BillingLink };

const LINK_LOOKUPS: {
  value: (reference: ProviderEventReference) => string | null;
  find: (tx: TenantTransaction, value: string) => Promise<BillingLink[]>;
}[] = [
  {
    value: (reference) => reference.checkoutId,
    find: (tx, value) =>
      tx
        .select({ orgId: sessions.orgId, contractId: sessions.contractId })
        .from(sessions)
        .where(eq(sessions.id, value)),
  },
  {
    value: (reference) => reference.providerSubscriptionId,
    find: (tx, value) =>
      tx
        .select({ orgId: subscriptions.orgId, contractId: subscriptions.contractId })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.provider, BILLING_PROVIDER),
            eq(subscriptions.providerSubscriptionId, value),
          ),
        ),
  },
];

async function findLink(
  tx: TenantTransaction,
  lookup: (typeof LINK_LOOKUPS)[number],
  reference: ProviderEventReference,
): Promise<BillingLink | null> {
  const value = lookup.value(reference);
  if (!value) return null;
  await tx.execute(sql`select set_config('app.billing_reference', ${value}, true)`);
  const [link] = await lookup.find(tx, value);
  return link ?? null;
}

export function resolveBillingLink(
  reference: ProviderEventReference,
): Promise<BillingLink | null> {
  return db.transaction(async (tx) => {
    for (const lookup of LINK_LOOKUPS) {
      const link = await findLink(tx, lookup, reference);
      if (link) return link;
    }
    return null;
  });
}

const contractScope = (
  table: typeof subscriptions | typeof entitlements,
  link: BillingLink,
) => and(eq(table.orgId, link.orgId), eq(table.contractId, link.contractId));

async function loadMirror({
  tx,
  link,
}: EventContext): Promise<SubscriptionMirror | null> {
  const [row] = await tx
    .select({
      providerSubscriptionId: subscriptions.providerSubscriptionId,
      providerCustomerId: subscriptions.providerCustomerId,
      status: subscriptions.status,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      canceledAt: subscriptions.canceledAt,
      lastEventAt: subscriptions.lastEventAt,
    })
    .from(subscriptions)
    .where(contractScope(subscriptions, link));
  return row ?? null;
}

async function registeredCheckout({ tx, link }: EventContext) {
  const [checkout] = await tx
    .select({ customerId: sessions.customerId, targets: sessions.targets })
    .from(sessions)
    .where(and(eq(sessions.orgId, link.orgId), eq(sessions.contractId, link.contractId)))
    .orderBy(desc(sessions.createdAt))
    .limit(1);
  return checkout ?? null;
}

async function createMirror(context: EventContext, mirror: SubscriptionMirror) {
  const { tx, link } = context;
  const checkout = await registeredCheckout(context);
  await tx
    .insert(subscriptions)
    .values({ ...mirror, ...link, provider: BILLING_PROVIDER, status: "incomplete" });
  if (!checkout || checkout.targets.length === 0) return;
  await tx.insert(entitlements).values(
    checkout.targets.map((target) => ({
      ...target,
      ...link,
      ...NOT_YET_PAID,
    })),
  );
}

async function syncEntitlements(
  { tx, link }: EventContext,
  mirror: SubscriptionMirror,
  asOf: Date,
  dueAt: Date | null,
): Promise<void> {
  const access = subscriptionAccess(mirror.status, {
    dueAt,
    asOf,
    policy: PROVISIONAL_DELINQUENCY_POLICY,
  });
  const current = await tx
    .select({
      id: entitlements.id,
      status: entitlements.status,
      reason: entitlements.reason,
    })
    .from(entitlements)
    .where(contractScope(entitlements, link))
    .orderBy(entitlements.id);
  for (const change of entitlementChanges(current, access)) {
    await tx
      .update(entitlements)
      .set({ status: change.status, reason: change.reason })
      .where(and(eq(entitlements.orgId, link.orgId), eq(entitlements.id, change.id)));
    if (change.statusChanged)
      await tx.execute(sql`select public.commercial_reconcile_grant(${change.id})`);
  }
}

async function rememberProviderCustomer(
  context: EventContext,
  providerCustomerId: string,
) {
  const checkout = await registeredCheckout(context);
  if (!checkout) return;
  await context.tx
    .insert(billingProviderCustomers)
    .values({
      orgId: context.link.orgId,
      customerId: checkout.customerId,
      provider: BILLING_PROVIDER,
      providerCustomerId,
    })
    .onConflictDoNothing();
}

async function completeCheckout(
  context: EventContext,
  event: CheckoutCompletedEvent,
): Promise<EventResult> {
  const { tx, link } = context;
  const completed = await tx
    .update(sessions)
    .set({ status: "completed", completedAt: event.occurredAt })
    .where(
      and(
        eq(sessions.orgId, link.orgId),
        eq(sessions.contractId, link.contractId),
        eq(sessions.providerSessionId, event.providerSessionId),
      ),
    )
    .returning({ id: sessions.id });
  if (completed.length === 0)
    return { outcome: "ignored", detail: "checkout_session_not_registered" };
  if (event.providerCustomerId)
    await rememberProviderCustomer(context, event.providerCustomerId);
  if (!event.providerSubscriptionId)
    return { outcome: "applied", detail: "checkout_completed_without_subscription" };
  const mirror = await loadMirror(context);
  if (mirror && mirror.providerSubscriptionId !== event.providerSubscriptionId)
    return { outcome: "ignored", detail: "another_subscription_for_contract" };
  if (!mirror)
    await createMirror(context, {
      providerSubscriptionId: event.providerSubscriptionId,
      providerCustomerId: event.providerCustomerId,
      status: "incomplete",
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      lastEventAt: null,
    });
  return { outcome: "applied", detail: "checkout_completed" };
}

async function expireCheckout(
  { tx, link }: EventContext,
  event: CheckoutExpiredEvent,
): Promise<EventResult> {
  const expired = await tx
    .update(sessions)
    .set({ status: "expired" })
    .where(
      and(
        eq(sessions.orgId, link.orgId),
        eq(sessions.providerSessionId, event.providerSessionId),
        eq(sessions.status, "open"),
      ),
    )
    .returning({ id: sessions.id });
  return expired.length > 0
    ? { outcome: "applied", detail: "checkout_expired" }
    : { outcome: "ignored", detail: "checkout_session_not_open" };
}

async function mirrorSubscription(
  context: EventContext,
  event: SubscriptionEvent,
): Promise<EventResult> {
  const current = await loadMirror(context);
  const decision = applySubscriptionSnapshot(current, event.snapshot, event.occurredAt);
  if (decision.outcome !== "applied") return decision;
  if (!current) await createMirror(context, decision.next);
  const { providerSubscriptionId: _registered, ...changes } = decision.next;
  await context.tx
    .update(subscriptions)
    .set(changes)
    .where(contractScope(subscriptions, context.link));
  await syncEntitlements(context, decision.next, event.occurredAt, null);
  return { outcome: "applied", detail: decision.next.status };
}

async function invoiceItems(tx: TenantTransaction, invoice: InvoiceSnapshot) {
  const lines = withUndetailedRemainder(invoice.lines, invoice.totalCents);
  const priceIds = lines.flatMap((line) => line.providerPriceId ?? []);
  const known = await tx
    .select({
      providerPriceId: prices.providerPriceId,
      service: commercialOfferItems.service,
    })
    .from(prices)
    .innerJoin(commercialOfferItems, eq(commercialOfferItems.id, prices.offerItemId))
    .where(
      and(
        eq(prices.provider, BILLING_PROVIDER),
        inArray(prices.providerPriceId, priceIds),
      ),
    );
  return classifyInvoiceLines(lines, known);
}

async function createInvoice({ tx, link }: EventContext, event: InvoiceEvent) {
  const { lines: _lines, ...header } = event.invoice;
  const [created] = await tx
    .insert(invoices)
    .values({
      ...header,
      ...link,
      provider: BILLING_PROVIDER,
      lastEventAt: event.occurredAt,
    })
    .returning({ id: invoices.id });
  const items = await invoiceItems(tx, event.invoice);
  if (items.length === 0) return;
  await tx
    .insert(billingInvoiceItems)
    .values(items.map((item) => ({ ...item, orgId: link.orgId, invoiceId: created.id })));
}

async function mirrorInvoice(
  context: EventContext,
  event: InvoiceEvent,
): Promise<EventResult> {
  const { tx, link } = context;
  const { status, totalCents, dueAt, paidAt, providerInvoiceId } = event.invoice;
  const [current] = await tx
    .select({
      id: invoices.id,
      status: invoices.status,
      lastEventAt: invoices.lastEventAt,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.orgId, link.orgId),
        eq(invoices.provider, BILLING_PROVIDER),
        eq(invoices.providerInvoiceId, providerInvoiceId),
      ),
    );
  if (applyInvoiceSnapshot(current ?? null, status, event.occurredAt) === "stale")
    return { outcome: "stale", detail: `invoice_kept:${current?.status}` };
  if (!current) await createInvoice(context, event);
  if (current)
    await tx
      .update(invoices)
      .set({ status, totalCents, dueAt, paidAt, lastEventAt: event.occurredAt })
      .where(and(eq(invoices.orgId, link.orgId), eq(invoices.id, current.id)));
  return { outcome: "applied", detail: `invoice_${status}` };
}

function applyEvent(context: EventContext, event: ProviderEvent): Promise<EventResult> {
  switch (event.kind) {
    case "checkout_completed":
      return completeCheckout(context, event);
    case "checkout_expired":
      return expireCheckout(context, event);
    case "subscription":
      return mirrorSubscription(context, event);
    case "invoice":
      return mirrorInvoice(context, event);
  }
}

export function recordProviderEvent(
  link: BillingLink,
  event: ProviderEvent,
): Promise<BillingEventOutcome | "duplicate"> {
  return withOrg(link.orgId, async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`commercial_billing:${link.contractId}`}, 0))`,
    );
    const [seen] = await tx
      .select({ id: billingEvents.id })
      .from(billingEvents)
      .where(
        and(
          eq(billingEvents.provider, BILLING_PROVIDER),
          eq(billingEvents.providerEventId, event.providerEventId),
        ),
      );
    if (seen) return "duplicate";
    const result = await applyEvent({ tx, link }, event);
    await tx.insert(billingEvents).values({
      ...link,
      ...result,
      provider: BILLING_PROVIDER,
      providerEventId: event.providerEventId,
      type: event.type,
      occurredAt: event.occurredAt,
    });
    return result.outcome;
  });
}

export function getContractBilling(ctx: TenantContext, contractId: string) {
  return withOrg(ctx.tenantId, async (tx) => {
    const link = { orgId: ctx.tenantId, contractId };
    const [contract] = await tx
      .select({ id: commercialContracts.id })
      .from(commercialContracts)
      .where(
        and(
          eq(commercialContracts.orgId, link.orgId),
          eq(commercialContracts.id, contractId),
        ),
      );
    if (!contract) throw new NotFoundError();
    const [checkout] = await tx
      .select({
        id: sessions.id,
        status: sessions.status,
        expiresAt: sessions.expiresAt,
        completedAt: sessions.completedAt,
      })
      .from(sessions)
      .where(and(eq(sessions.orgId, link.orgId), eq(sessions.contractId, contractId)))
      .orderBy(desc(sessions.createdAt))
      .limit(1);
    const [subscription] = await tx
      .select({
        status: subscriptions.status,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        canceledAt: subscriptions.canceledAt,
        updatedAt: subscriptions.updatedAt,
      })
      .from(subscriptions)
      .where(contractScope(subscriptions, link));
    const rights = await tx
      .select({
        companyId: entitlements.companyId,
        service: entitlements.service,
        status: entitlements.status,
        reason: entitlements.reason,
        applied: entitlements.applied,
        updatedAt: entitlements.updatedAt,
      })
      .from(entitlements)
      .where(contractScope(entitlements, link))
      .orderBy(sql`${entitlements.companyId} nulls first`, entitlements.service);
    return {
      contractId,
      checkout: checkout ?? null,
      subscription: subscription ?? null,
      entitlements: rights,
      delinquencyPolicy: PROVISIONAL_DELINQUENCY_POLICY,
    };
  });
}
