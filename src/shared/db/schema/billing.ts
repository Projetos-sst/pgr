import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  unique,
  check,
  foreignKey,
  pgPolicy,
} from "drizzle-orm/pg-core";

import type {
  BillingEventOutcome,
  CheckoutStatus,
  EntitlementService,
  EntitlementTarget,
  EntitlementStatus,
  InvoiceItemService,
  InvoiceStatus,
  SubscriptionStatus,
} from "@/shared/domains/commercial/billing-model";

import { appRuntimeRole } from "../roles";
import { actorCompanyScope, officeWideOr } from "./access-scope-policy";
import {
  commercialContracts,
  commercialCustomers,
  commercialOfferItems,
} from "./commercial";
import { companies } from "./companies";
import { orgs } from "./orgs";

const tenant = sql`org_id=current_setting('app.current_org',true)`;
const actor = sql`nullif(current_setting('app.current_actor',true),'')`;
const reference = sql`nullif(current_setting('app.billing_reference',true),'')`;
const providerEvent = sql`${actor} is null`;
const administrator = sql`exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=${actor} and m.role in ('owner','org:admin'))`;
const reader = sql`(${providerEvent} or ${administrator})`;

const mirrorPolicies = (table: string) => [
  pgPolicy(`${table}_tenant`, {
    for: "all",
    to: appRuntimeRole,
    using: tenant,
    withCheck: tenant,
  }),
  pgPolicy(`${table}_provider_event`, {
    as: "restrictive",
    for: "all",
    to: appRuntimeRole,
    using: reader,
    withCheck: providerEvent,
  }),
];

const provider = () => text("provider").notNull();
const orgId = () =>
  text("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" });
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const billingProviderPrices = pgTable(
  "billing_provider_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: provider(),
    offerItemId: uuid("offer_item_id")
      .notNull()
      .references(() => commercialOfferItems.id),
    providerPriceId: text("provider_price_id").notNull(),
    mappedBy: text("mapped_by").notNull(),
    mappedAt: timestamp("mapped_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_billing_provider_prices_item").on(t.provider, t.offerItemId),
    unique("uq_billing_provider_prices_price").on(t.provider, t.providerPriceId),
    check("billing_provider_prices_provider", sql`${t.provider} = 'stripe'`),
    check(
      "billing_provider_prices_price",
      sql`btrim(${t.providerPriceId}) <> '' and btrim(${t.mappedBy}) <> ''`,
    ),
    pgPolicy("billing_provider_prices_read", {
      for: "select",
      to: appRuntimeRole,
      using: sql`true`,
    }),
  ],
).enableRLS();

export const billingProviderCustomers = pgTable(
  "billing_provider_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgId(),
    customerId: uuid("customer_id").notNull(),
    provider: provider(),
    providerCustomerId: text("provider_customer_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("uq_billing_provider_customers_customer").on(t.provider, t.customerId),
    unique("uq_billing_provider_customers_provider").on(t.provider, t.providerCustomerId),
    foreignKey({
      name: "billing_provider_customers_customer_fk",
      columns: [t.customerId, t.orgId],
      foreignColumns: [commercialCustomers.id, commercialCustomers.orgId],
    }),
    check("billing_provider_customers_provider", sql`${t.provider} = 'stripe'`),
    ...mirrorPolicies("billing_provider_customers"),
  ],
).enableRLS();

export const billingCheckoutSessions = pgTable(
  "billing_checkout_sessions",
  {
    id: uuid("id").primaryKey(),
    orgId: orgId(),
    contractId: uuid("contract_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    targets: jsonb("targets").$type<EntitlementTarget[]>().notNull(),
    provider: provider(),
    idempotencyKey: text("idempotency_key").notNull(),
    providerSessionId: text("provider_session_id").notNull(),
    url: text("url").notNull(),
    status: text("status").$type<CheckoutStatus>().notNull().default("open"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    unique("uq_billing_checkout_sessions_key").on(t.orgId, t.idempotencyKey),
    unique("uq_billing_checkout_sessions_provider").on(t.provider, t.providerSessionId),
    index("idx_billing_checkout_sessions_contract").on(t.orgId, t.contractId),
    foreignKey({
      name: "billing_checkout_sessions_contract_fk",
      columns: [t.contractId, t.orgId],
      foreignColumns: [commercialContracts.id, commercialContracts.orgId],
    }),
    foreignKey({
      name: "billing_checkout_sessions_customer_fk",
      columns: [t.customerId, t.orgId],
      foreignColumns: [commercialCustomers.id, commercialCustomers.orgId],
    }),
    check("billing_checkout_sessions_provider", sql`${t.provider} = 'stripe'`),
    check("billing_checkout_sessions_targets", sql`jsonb_typeof(${t.targets}) = 'array'`),
    check(
      "billing_checkout_sessions_status",
      sql`${t.status} in ('open','completed','expired')`,
    ),
    pgPolicy("billing_checkout_sessions_tenant", {
      for: "all",
      to: appRuntimeRole,
      using: tenant,
      withCheck: tenant,
    }),
    pgPolicy("billing_checkout_sessions_reference", {
      for: "select",
      to: appRuntimeRole,
      using: sql`${providerEvent} and ${t.id}::text = ${reference}`,
    }),
    pgPolicy("billing_checkout_sessions_reader", {
      as: "restrictive",
      for: "select",
      to: appRuntimeRole,
      using: reader,
    }),
    pgPolicy("billing_checkout_sessions_author", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${administrator} and ${t.createdBy}=${actor}`,
    }),
    pgPolicy("billing_checkout_sessions_provider_event", {
      as: "restrictive",
      for: "update",
      to: appRuntimeRole,
      using: providerEvent,
      withCheck: providerEvent,
    }),
  ],
).enableRLS();

export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgId(),
    contractId: uuid("contract_id").notNull(),
    provider: provider(),
    providerSubscriptionId: text("provider_subscription_id").notNull(),
    providerCustomerId: text("provider_customer_id"),
    status: text("status").$type<SubscriptionStatus>().notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("uq_billing_subscriptions_contract").on(t.contractId),
    unique("uq_billing_subscriptions_provider").on(t.provider, t.providerSubscriptionId),
    foreignKey({
      name: "billing_subscriptions_contract_fk",
      columns: [t.contractId, t.orgId],
      foreignColumns: [commercialContracts.id, commercialContracts.orgId],
    }),
    check("billing_subscriptions_provider", sql`${t.provider} = 'stripe'`),
    check(
      "billing_subscriptions_status",
      sql`${t.status} in ('incomplete','incomplete_expired','trialing','active','past_due','unpaid','canceled','paused')`,
    ),
    ...mirrorPolicies("billing_subscriptions"),
    pgPolicy("billing_subscriptions_reference", {
      for: "select",
      to: appRuntimeRole,
      using: sql`${providerEvent} and ${t.providerSubscriptionId} = ${reference}`,
    }),
  ],
).enableRLS();

export const billingEvents = pgTable(
  "billing_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgId(),
    contractId: uuid("contract_id").notNull(),
    provider: provider(),
    providerEventId: text("provider_event_id").notNull(),
    type: text("type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    outcome: text("outcome").$type<BillingEventOutcome>().notNull(),
    detail: text("detail").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_billing_events_provider_event").on(t.provider, t.providerEventId),
    index("idx_billing_events_contract").on(t.orgId, t.contractId, t.occurredAt),
    foreignKey({
      name: "billing_events_contract_fk",
      columns: [t.contractId, t.orgId],
      foreignColumns: [commercialContracts.id, commercialContracts.orgId],
    }),
    check("billing_events_provider", sql`${t.provider} = 'stripe'`),
    check("billing_events_outcome", sql`${t.outcome} in ('applied','stale','ignored')`),
    ...mirrorPolicies("billing_events"),
  ],
).enableRLS();

export const commercialEntitlements = pgTable(
  "commercial_entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgId(),
    contractId: uuid("contract_id").notNull(),
    companyId: uuid("company_id"),
    service: text("service").$type<EntitlementService>().notNull(),
    status: text("status").$type<EntitlementStatus>().notNull(),
    reason: text("reason").notNull(),
    applied: boolean("applied").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("uq_commercial_entitlements_target")
      .on(t.contractId, t.companyId, t.service)
      .nullsNotDistinct(),
    index("idx_commercial_entitlements_target").on(t.orgId, t.companyId, t.service),
    foreignKey({
      name: "commercial_entitlements_contract_fk",
      columns: [t.contractId, t.orgId],
      foreignColumns: [commercialContracts.id, commercialContracts.orgId],
    }),
    foreignKey({
      name: "commercial_entitlements_company_fk",
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }),
    check(
      "commercial_entitlements_service",
      sql`${t.service} in ('pgr','medicine','pro')`,
    ),
    check("commercial_entitlements_status", sql`${t.status} in ('active','inactive')`),
    check(
      "commercial_entitlements_target",
      sql`(${t.service} = 'pro') = (${t.companyId} is null)`,
    ),
    ...mirrorPolicies("commercial_entitlements"),
    pgPolicy("commercial_entitlements_actor_scope", {
      as: "restrictive",
      for: "select",
      to: appRuntimeRole,
      using: officeWideOr(t.companyId, actorCompanyScope(t.companyId)),
    }),
  ],
).enableRLS();

export const billingInvoices = pgTable(
  "billing_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgId(),
    contractId: uuid("contract_id").notNull(),
    provider: provider(),
    providerInvoiceId: text("provider_invoice_id").notNull(),
    status: text("status").$type<InvoiceStatus>().notNull(),
    currency: text("currency").notNull(),
    totalCents: integer("total_cents").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("uq_billing_invoices_id_org").on(t.id, t.orgId),
    unique("uq_billing_invoices_provider").on(t.provider, t.providerInvoiceId),
    index("idx_billing_invoices_contract").on(t.orgId, t.contractId),
    foreignKey({
      name: "billing_invoices_contract_fk",
      columns: [t.contractId, t.orgId],
      foreignColumns: [commercialContracts.id, commercialContracts.orgId],
    }),
    check("billing_invoices_provider", sql`${t.provider} = 'stripe'`),
    check(
      "billing_invoices_status",
      sql`${t.status} in ('open','paid','void','uncollectible')`,
    ),
    ...mirrorPolicies("billing_invoices"),
  ],
).enableRLS();

export const billingInvoiceItems = pgTable(
  "billing_invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgId(),
    invoiceId: uuid("invoice_id").notNull(),
    position: integer("position").notNull(),
    service: text("service").$type<InvoiceItemService>().notNull(),
    label: text("label").notNull(),
    quantity: integer("quantity").notNull(),
    amountCents: integer("amount_cents").notNull(),
    providerPriceId: text("provider_price_id"),
  },
  (t) => [
    unique("uq_billing_invoice_items_position").on(t.invoiceId, t.position),
    foreignKey({
      name: "billing_invoice_items_invoice_fk",
      columns: [t.invoiceId, t.orgId],
      foreignColumns: [billingInvoices.id, billingInvoices.orgId],
    }),
    check("billing_invoice_items_position", sql`${t.position} > 0`),
    check(
      "billing_invoice_items_service",
      sql`${t.service} in ('pgr','medicine','pro','one_off','unclassified')`,
    ),
    ...mirrorPolicies("billing_invoice_items"),
  ],
).enableRLS();
