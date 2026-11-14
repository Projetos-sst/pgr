import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  date,
  jsonb,
  timestamp,
  index,
  unique,
  uniqueIndex,
  check,
  foreignKey,
  primaryKey,
  pgPolicy,
} from "drizzle-orm/pg-core";

import type { CustomerKind, CustomerStatus } from "@/shared/domains/commercial/contract";
import {
  INTEREST_MESSAGE_MAX_LENGTH,
  type InterestService,
} from "@/shared/domains/commercial/interest";
import type { OneOffOrderStatus } from "@/shared/domains/commercial/one-off-order";
import type {
  BillingPeriod,
  CommercialService,
  CommercialUnit,
  OfferQuota,
  OfferScope,
} from "@/shared/domains/commercial/offer";

import { appRuntimeRole } from "../roles";
import { actorCompanyScope, officeWideOr } from "./access-scope-policy";
import { companies } from "./companies";
import { orgs } from "./orgs";
import { platformOperator, platformOperatorRead } from "./platform-operator-policy";

const tenant = sql`org_id=current_setting('app.current_org',true)`;
const actor = sql`current_setting('app.current_actor',true)`;
const administrator = sql`exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=${actor} and m.role in ('owner','org:admin'))`;

const tenantPolicies = (table: string, operatorRead = false) => [
  pgPolicy(`${table}_tenant`, {
    for: "all",
    to: appRuntimeRole,
    using: tenant,
    withCheck: tenant,
  }),
  pgPolicy(`${table}_administrator`, {
    as: "restrictive",
    for: "all",
    to: appRuntimeRole,
    using: operatorRead ? sql`(${administrator} or ${platformOperator})` : administrator,
    withCheck: administrator,
  }),
  ...(operatorRead ? [platformOperatorRead(table)] : []),
];

export const commercialOfferVersions = pgTable(
  "commercial_offer_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    scope: text("scope").$type<OfferScope>().notNull(),
    currency: text("currency").notNull(),
    billingPeriod: text("billing_period").$type<BillingPeriod>().notNull(),
    quotas: jsonb("quotas").$type<OfferQuota[]>().notNull(),
    validFrom: date("valid_from").notNull(),
    validUntil: date("valid_until"),
    fictitious: boolean("fictitious").notNull(),
    approvalReference: text("approval_reference"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: text("published_by"),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    deactivatedBy: text("deactivated_by"),
    deactivationReason: text("deactivation_reason"),
  },
  (t) => [
    unique("uq_commercial_offer_versions_code_version").on(t.code, t.version),
    check("commercial_offer_versions_version", sql`${t.version} > 0`),
    check(
      "commercial_offer_versions_scope",
      sql`${t.scope} in ('organization','company')`,
    ),
    check("commercial_offer_versions_currency", sql`${t.currency} = 'BRL'`),
    check(
      "commercial_offer_versions_period",
      sql`${t.billingPeriod} in ('monthly','annual','one_time')`,
    ),
    check(
      "commercial_offer_versions_validity",
      sql`${t.validUntil} is null or ${t.validUntil} >= ${t.validFrom}`,
    ),
    check(
      "commercial_offer_versions_fictitious_code",
      sql`${t.fictitious} = (${t.code} like 'ficticio-%')`,
    ),
    check(
      "commercial_offer_versions_approval",
      sql`case when ${t.fictitious} then ${t.approvalReference} is null else btrim(coalesce(${t.approvalReference},'')) <> '' end`,
    ),
    check(
      "commercial_offer_versions_publication",
      sql`(${t.publishedAt} is null) = (${t.publishedBy} is null)`,
    ),
    check(
      "commercial_offer_versions_deactivation",
      sql`case when ${t.deactivatedAt} is null then ${t.deactivatedBy} is null and ${t.deactivationReason} is null else ${t.publishedAt} is not null and ${t.deactivatedBy} is not null and btrim(coalesce(${t.deactivationReason},'')) <> '' end`,
    ),
    pgPolicy("commercial_offer_versions_published_read", {
      for: "select",
      to: appRuntimeRole,
      using: sql`${t.publishedAt} is not null`,
    }),
  ],
).enableRLS();

export const commercialOfferItems = pgTable(
  "commercial_offer_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerVersionId: uuid("offer_version_id")
      .notNull()
      .references(() => commercialOfferVersions.id),
    position: integer("position").notNull(),
    service: text("service").$type<CommercialService>().notNull(),
    label: text("label").notNull(),
    unit: text("unit").$type<CommercialUnit>().notNull(),
    unitAmountCents: integer("unit_amount_cents").notNull(),
  },
  (t) => [
    unique("uq_commercial_offer_items_position").on(t.offerVersionId, t.position),
    unique("uq_commercial_offer_items_label").on(t.offerVersionId, t.label),
    check("commercial_offer_items_position", sql`${t.position} > 0`),
    check(
      "commercial_offer_items_service",
      sql`${t.service} in ('pgr','medicine','pro','one_off')`,
    ),
    check(
      "commercial_offer_items_unit",
      sql`${t.unit} in ('organization','company','employee','document')`,
    ),
    check(
      "commercial_offer_items_amount",
      sql`${t.unitAmountCents} between 0 and 100000000`,
    ),
    pgPolicy("commercial_offer_items_published_read", {
      for: "select",
      to: appRuntimeRole,
      using: sql`exists(select 1 from public.commercial_offer_versions v where v.id=${t.offerVersionId} and v.published_at is not null)`,
    }),
  ],
).enableRLS();

export const commercialCustomers = pgTable(
  "commercial_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    kind: text("kind").$type<CustomerKind>().notNull(),
    companyId: uuid("company_id"),
    legalName: text("legal_name"),
    taxId: text("tax_id"),
    billingEmail: text("billing_email").notNull(),
    status: text("status").$type<CustomerStatus>().notNull().default("active"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_commercial_customers_id_org").on(t.id, t.orgId),
    unique("uq_commercial_customers_company").on(t.orgId, t.companyId),
    uniqueIndex("uq_commercial_customers_office")
      .on(t.orgId)
      .where(sql`${t.kind} = 'office'`),
    foreignKey({
      name: "commercial_customers_company_fk",
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }),
    check("commercial_customers_kind", sql`${t.kind} in ('office','company')`),
    check("commercial_customers_status", sql`${t.status} in ('active','inactive')`),
    check(
      "commercial_customers_identity",
      sql`case ${t.kind}
        when 'company' then ${t.companyId} is not null and ${t.legalName} is null and ${t.taxId} is null
        else ${t.companyId} is null and btrim(coalesce(${t.legalName},'')) <> '' and coalesce(${t.taxId},'') ~ '^([0-9]{11}|[0-9]{14})$'
      end`,
    ),
    ...tenantPolicies("commercial_customers"),
    pgPolicy("commercial_customers_actor_scope", {
      as: "restrictive",
      for: "select",
      to: appRuntimeRole,
      using: officeWideOr(t.companyId, actorCompanyScope(t.companyId)),
    }),
    pgPolicy("commercial_customers_actor", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.createdBy}=${actor}`,
    }),
  ],
).enableRLS();

export const commercialContracts = pgTable(
  "commercial_contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seq: bigint("seq", { mode: "number" }).notNull().generatedAlwaysAsIdentity(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull(),
    offerVersionId: uuid("offer_version_id")
      .notNull()
      .references(() => commercialOfferVersions.id),
    customerKind: text("customer_kind").$type<CustomerKind>().notNull(),
    customerLegalName: text("customer_legal_name").notNull(),
    customerTaxId: text("customer_tax_id").notNull(),
    offerCode: text("offer_code").notNull(),
    offerVersion: integer("offer_version").notNull(),
    offerName: text("offer_name").notNull(),
    offerScope: text("offer_scope").$type<OfferScope>().notNull(),
    currency: text("currency").notNull(),
    billingPeriod: text("billing_period").$type<BillingPeriod>().notNull(),
    quotas: jsonb("quotas").$type<OfferQuota[]>().notNull(),
    fictitious: boolean("fictitious").notNull(),
    termStart: date("term_start").notNull(),
    termEnd: date("term_end"),
    contractedBy: text("contracted_by").notNull(),
    contractedAt: timestamp("contracted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("uq_commercial_contracts_id_org").on(t.id, t.orgId),
    index("idx_commercial_contracts_org_seq").on(t.orgId, t.seq),
    index("idx_commercial_contracts_customer").on(t.orgId, t.customerId),
    foreignKey({
      name: "commercial_contracts_customer_fk",
      columns: [t.customerId, t.orgId],
      foreignColumns: [commercialCustomers.id, commercialCustomers.orgId],
    }),
    check(
      "commercial_contracts_customer_kind",
      sql`${t.customerKind} in ('office','company')`,
    ),
    check(
      "commercial_contracts_scope",
      sql`${t.offerScope} in ('organization','company')`,
    ),
    check("commercial_contracts_currency", sql`${t.currency} = 'BRL'`),
    check(
      "commercial_contracts_period",
      sql`${t.billingPeriod} in ('monthly','annual','one_time')`,
    ),
    check(
      "commercial_contracts_term",
      sql`${t.termEnd} is null or ${t.termEnd} >= ${t.termStart}`,
    ),
    ...tenantPolicies("commercial_contracts", true),
    pgPolicy("commercial_contracts_actor", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.contractedBy}=${actor}`,
    }),
  ],
).enableRLS();

export const commercialContractItems = pgTable(
  "commercial_contract_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id").notNull(),
    position: integer("position").notNull(),
    service: text("service").$type<CommercialService>().notNull(),
    label: text("label").notNull(),
    unit: text("unit").$type<CommercialUnit>().notNull(),
    unitAmountCents: integer("unit_amount_cents").notNull(),
  },
  (t) => [
    unique("uq_commercial_contract_items_position").on(t.contractId, t.position),
    foreignKey({
      name: "commercial_contract_items_contract_fk",
      columns: [t.contractId, t.orgId],
      foreignColumns: [commercialContracts.id, commercialContracts.orgId],
    }),
    check("commercial_contract_items_position", sql`${t.position} > 0`),
    check(
      "commercial_contract_items_service",
      sql`${t.service} in ('pgr','medicine','pro','one_off')`,
    ),
    check(
      "commercial_contract_items_unit",
      sql`${t.unit} in ('organization','company','employee','document')`,
    ),
    check(
      "commercial_contract_items_amount",
      sql`${t.unitAmountCents} between 0 and 100000000`,
    ),
    ...tenantPolicies("commercial_contract_items", true),
  ],
).enableRLS();

export const commercialContractCompanies = pgTable(
  "commercial_contract_companies",
  {
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id").notNull(),
    companyId: uuid("company_id").notNull(),
  },
  (t) => [
    primaryKey({
      name: "commercial_contract_companies_pk",
      columns: [t.contractId, t.companyId],
    }),
    index("idx_commercial_contract_companies_company").on(t.orgId, t.companyId),
    foreignKey({
      name: "commercial_contract_companies_contract_fk",
      columns: [t.contractId, t.orgId],
      foreignColumns: [commercialContracts.id, commercialContracts.orgId],
    }),
    foreignKey({
      name: "commercial_contract_companies_company_fk",
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }),
    ...tenantPolicies("commercial_contract_companies"),
    pgPolicy("commercial_contract_companies_actor_scope", {
      as: "restrictive",
      for: "select",
      to: appRuntimeRole,
      using: actorCompanyScope(t.companyId),
    }),
  ],
).enableRLS();

export const commercialInterests = pgTable(
  "commercial_interests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    service: text("service").$type<InterestService>().notNull(),
    message: text("message"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    seenBy: text("seen_by"),
  },
  (t) => [
    unique("uq_commercial_interests_id_org").on(t.id, t.orgId),
    uniqueIndex("uq_commercial_interests_open")
      .on(t.orgId, t.companyId, t.service)
      .where(sql`${t.seenAt} is null`),
    index("idx_commercial_interests_org_created").on(t.orgId, t.createdAt),
    foreignKey({
      name: "commercial_interests_company_fk",
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }),
    check(
      "commercial_interests_service",
      sql`${t.service} in ('pgr','medicine','pro','one_off')`,
    ),
    check(
      "commercial_interests_message",
      sql`${t.message} is null or (btrim(${t.message}) <> '' and char_length(${t.message}) <= ${sql.raw(String(INTEREST_MESSAGE_MAX_LENGTH))})`,
    ),
    check(
      "commercial_interests_seen",
      sql`(${t.seenAt} is null) = (${t.seenBy} is null)`,
    ),
    pgPolicy("commercial_interests_tenant", {
      for: "all",
      to: appRuntimeRole,
      using: tenant,
      withCheck: tenant,
    }),
    pgPolicy("commercial_interests_actor_scope", {
      as: "restrictive",
      for: "select",
      to: appRuntimeRole,
      using: actorCompanyScope(t.companyId),
    }),
    pgPolicy("commercial_interests_actor", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.createdBy}=${actor} and ${actorCompanyScope(t.companyId)}`,
    }),
  ],
).enableRLS();

const providerEvent = sql`nullif(current_setting('app.current_actor',true),'') is null`;

export const commercialOneOffOrders = pgTable(
  "commercial_one_off_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id").notNull(),
    companyId: uuid("company_id").notNull(),
    status: text("status").$type<OneOffOrderStatus>().notNull().default("pending"),
    providerPaymentRef: text("provider_payment_ref"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_commercial_one_off_orders_contract").on(t.orgId, t.contractId),
    index("idx_commercial_one_off_orders_company").on(t.orgId, t.companyId, t.status),
    foreignKey({
      name: "commercial_one_off_orders_contract_fk",
      columns: [t.contractId, t.orgId],
      foreignColumns: [commercialContracts.id, commercialContracts.orgId],
    }),
    foreignKey({
      name: "commercial_one_off_orders_company_fk",
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }),
    check(
      "commercial_one_off_orders_status",
      sql`${t.status} in ('pending','paid','cancelled')`,
    ),
    check(
      "commercial_one_off_orders_paid",
      sql`(${t.status} = 'paid') = (${t.paidAt} is not null)`,
    ),
    pgPolicy("commercial_one_off_orders_tenant", {
      for: "all",
      to: appRuntimeRole,
      using: tenant,
      withCheck: tenant,
    }),
    pgPolicy("commercial_one_off_orders_actor_scope", {
      as: "restrictive",
      for: "select",
      to: appRuntimeRole,
      using: actorCompanyScope(t.companyId),
    }),
    pgPolicy("commercial_one_off_orders_actor", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.createdBy}=${actor} and ${administrator} and ${actorCompanyScope(t.companyId)}`,
    }),
    pgPolicy("commercial_one_off_orders_provider_event", {
      as: "restrictive",
      for: "update",
      to: appRuntimeRole,
      using: providerEvent,
      withCheck: providerEvent,
    }),
  ],
).enableRLS();

export const commercialTrials = pgTable(
  "commercial_trials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    days: integer("days").notNull(),
    startedBy: text("started_by").notNull(),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
  },
  (t) => [
    unique("uq_commercial_trials_company").on(t.orgId, t.companyId),
    index("idx_commercial_trials_org_started").on(t.orgId, t.startedAt),
    foreignKey({
      name: "commercial_trials_company_fk",
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }),
    check("commercial_trials_window", sql`${t.endsAt} > ${t.startedAt}`),
    check("commercial_trials_days", sql`${t.days} > 0`),
    pgPolicy("commercial_trials_tenant", {
      for: "all",
      to: appRuntimeRole,
      using: tenant,
      withCheck: tenant,
    }),
    pgPolicy("commercial_trials_actor_scope", {
      as: "restrictive",
      for: "select",
      to: appRuntimeRole,
      using: actorCompanyScope(t.companyId),
    }),
    pgPolicy("commercial_trials_actor", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.startedBy}=${actor} and ${actorCompanyScope(t.companyId)}`,
    }),
  ],
).enableRLS();
