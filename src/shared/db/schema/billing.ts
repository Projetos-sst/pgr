import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
  foreignKey,
  pgPolicy,
  check,
  index,
} from "drizzle-orm/pg-core";
import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { companies } from "./companies";
import type {
  BillingPriceItem,
  BillingOfferInput,
  BillingStatus,
  NormalizedBillingEvent,
} from "@/shared/domains/billing/contracts";

// Financial information is never readable by an ordinary office collaborator.
const owner = sql`org_id=current_setting('app.current_org',true) and exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))`;
const policies = (name: string) => [
  pgPolicy(`${name}_owner`, {
    for: "all",
    to: appRuntimeRole,
    using: owner,
    withCheck: owner,
  }),
];
const identity = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: text("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
});
const created = () => ({
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const billingCustomers = pgTable(
  "billing_customers",
  {
    ...identity(),
    companyId: uuid("company_id").notNull(),
    name: text("name").notNull(),
    providerCustomerId: text("provider_customer_id").notNull(),
    ...created(),
  },
  (t) => [
    unique("uq_billing_customer_company").on(t.orgId, t.companyId),
    unique("uq_billing_customer_org").on(t.id, t.orgId),
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("restrict"),
    ...policies("billing_customers"),
  ],
).enableRLS();

/** Immutable catalog versions. A new price creates a new row, never edits contracts. */
export const billingOffers = pgTable(
  "billing_offer_versions",
  {
    ...identity(),
    code: text("code").notNull(),
    version: integer("version").notNull(),
    data: jsonb("data").$type<BillingOfferInput>().notNull(),
    ...created(),
  },
  (t) => [
    unique("uq_billing_offer_version").on(t.orgId, t.code, t.version),
    unique("uq_billing_offer_org").on(t.id, t.orgId),
    check("billing_offer_positive_version", sql`${t.version}>0`),
    ...policies("billing_offer_versions"),
  ],
).enableRLS();

export const billingContracts = pgTable(
  "billing_contracts",
  {
    ...identity(),
    customerId: uuid("customer_id").notNull(),
    offerId: uuid("offer_id").notNull(),
    snapshot: jsonb("snapshot").$type<BillingOfferInput>().notNull(),
    status: text("status").$type<BillingStatus>().notNull().default("pending_payment"),
    revision: integer("revision").notNull().default(0),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    providerSubscriptionId: text("provider_subscription_id").notNull(),
    ...created(),
  },
  (t) => [
    unique("uq_billing_contract_org").on(t.id, t.orgId),
    foreignKey({
      columns: [t.customerId, t.orgId],
      foreignColumns: [billingCustomers.id, billingCustomers.orgId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.offerId, t.orgId],
      foreignColumns: [billingOffers.id, billingOffers.orgId],
    }).onDelete("restrict"),
    check(
      "billing_contract_status",
      sql`${t.status} in ('pending_payment','requires_action','trialing','active','past_due','unpaid','canceled','expired')`,
    ),
    check("billing_contract_revision", sql`${t.revision}>=0`),
    index("idx_billing_contract_customer").on(t.orgId, t.customerId),
    ...policies("billing_contracts"),
  ],
).enableRLS();

export const billingInvoices = pgTable(
  "billing_invoices",
  {
    ...identity(),
    contractId: uuid("contract_id").notNull(),
    eventId: text("event_id").notNull(),
    providerInvoiceId: text("provider_invoice_id").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    items: jsonb("items").$type<BillingPriceItem[]>().notNull().default([]),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("BRL"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_billing_invoice_event").on(t.orgId, t.eventId),
    unique("uq_billing_provider_invoice").on(t.orgId, t.providerInvoiceId),
    foreignKey({
      columns: [t.contractId, t.orgId],
      foreignColumns: [billingContracts.id, billingContracts.orgId],
    }).onDelete("restrict"),
    check("billing_invoice_amount", sql`${t.amountMinor} between 0 and 99999999`),
    check("billing_invoice_status", sql`${t.status} in ('open','paid','void')`),
    ...policies("billing_invoices"),
  ],
).enableRLS();

/** Event inbox is append-only. Applied and stale events are both retained. */
export const billingEvents = pgTable(
  "billing_events",
  {
    ...identity(),
    contractId: uuid("contract_id").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    payload: jsonb("payload").$type<NormalizedBillingEvent>().notNull(),
    applied: boolean("applied").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_billing_provider_event").on(t.orgId, t.providerEventId),
    foreignKey({
      columns: [t.contractId, t.orgId],
      foreignColumns: [billingContracts.id, billingContracts.orgId],
    }).onDelete("restrict"),
    ...policies("billing_events"),
  ],
).enableRLS();

/** Tenant-scoped operation key and request hash prevent idempotency-key reuse. */
export const billingOperations = pgTable(
  "billing_operations",
  {
    ...identity(),
    key: text("key").notNull(),
    kind: text("kind").notNull(),
    requestHash: text("request_hash").notNull(),
    resultId: uuid("result_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...created(),
  },
  (t) => [
    unique("uq_billing_operation_key").on(t.orgId, t.key),
    ...policies("billing_operations"),
  ],
).enableRLS();

export const billingQuotes = pgTable(
  "billing_change_quotes",
  {
    ...identity(),
    contractId: uuid("contract_id").notNull(),
    offerId: uuid("offer_id").notNull(),
    expectedRevision: integer("expected_revision").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    ...created(),
  },
  (t) => [
    foreignKey({
      columns: [t.contractId, t.orgId],
      foreignColumns: [billingContracts.id, billingContracts.orgId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.offerId, t.orgId],
      foreignColumns: [billingOffers.id, billingOffers.orgId],
    }).onDelete("restrict"),
    ...policies("billing_change_quotes"),
  ],
).enableRLS();

/** Separate entitlement rows: a one-off purchase is scoped to its order, not a whole module. */
export const billingEntitlements = pgTable(
  "billing_entitlements",
  {
    ...identity(),
    contractId: uuid("contract_id").notNull(),
    companyId: uuid("company_id").notNull(),
    product: text("product").notNull(),
    scope: text("scope").notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    active: boolean("active").notNull().default(false),
  },
  (t) => [
    unique("uq_billing_entitlement").on(t.orgId, t.contractId, t.product),
    foreignKey({
      columns: [t.contractId, t.orgId],
      foreignColumns: [billingContracts.id, billingContracts.orgId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("restrict"),
    check("billing_entitlement_product", sql`${t.product} in ('pro','pgr','medicine')`),
    ...policies("billing_entitlements"),
  ],
).enableRLS();

export const billingTrials = pgTable(
  "billing_trials",
  {
    ...identity(),
    companyId: uuid("company_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    ...created(),
  },
  (t) => [
    unique("uq_billing_trial_company").on(t.orgId, t.companyId),
    unique("uq_billing_trial_org").on(t.id, t.orgId),
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("restrict"),
    check("billing_trial_duration", sql`${t.endsAt}=${t.startedAt}+interval '15 days'`),
    ...policies("billing_trials"),
    pgPolicy("billing_trials_tenant_read", {
      for: "select",
      to: appRuntimeRole,
      using: sql`org_id=current_setting('app.current_org',true)`,
    }),
  ],
).enableRLS();

/** Internal commercial inbox only; no email/WhatsApp delivery is triggered. */
export const billingInterests = pgTable(
  "billing_interests",
  {
    ...identity(),
    trialId: uuid("trial_id").notNull(),
    interest: text("interest").notNull(),
    message: text("message").notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    ...created(),
  },
  (t) => [
    unique("uq_billing_interest_trial").on(t.orgId, t.trialId, t.interest),
    foreignKey({
      columns: [t.trialId, t.orgId],
      foreignColumns: [billingTrials.id, billingTrials.orgId],
    }).onDelete("restrict"),
    ...policies("billing_interests"),
  ],
).enableRLS();

/** Durable simulated provider authority, separate from the event inbox/read model. */
export const billingProviderStates = pgTable(
  "billing_provider_states",
  {
    ...identity(),
    contractId: uuid("contract_id").notNull(),
    payload: jsonb("payload").$type<NormalizedBillingEvent>().notNull(),
  },
  (t) => [
    unique("uq_billing_provider_contract").on(t.orgId, t.contractId),
    foreignKey({
      columns: [t.contractId, t.orgId],
      foreignColumns: [billingContracts.id, billingContracts.orgId],
    }).onDelete("restrict"),
    ...policies("billing_provider_states"),
  ],
).enableRLS();

export const billingAudit = pgTable(
  "billing_audit",
  {
    ...identity(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    ...created(),
  },
  () => [...policies("billing_audit")],
).enableRLS();
