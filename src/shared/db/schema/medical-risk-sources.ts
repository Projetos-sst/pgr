import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  jsonb,
  integer,
  unique,
  check,
  index,
  foreignKey,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { appRuntimeRole } from "../roles";
import { companies } from "./companies";
import { companyModuleScope } from "./module-policy";
import type {
  MedicalRiskSnapshot,
  MedicalRiskStatus,
} from "@/shared/domains/medicine/risk-sources";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const medicalRiskSources = pgTable(
  "medical_risk_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    companyId: uuid("company_id").notNull(),
    kind: text("kind").$type<"internal" | "external">().notNull(),
    title: text("title").notNull(),
    version: text("version").notNull(),
    reference: text("reference").notNull(),
    // PGR externo (NOB-111): proveniência informada pelo documento; nunca preenchida por suposição.
    documentDate: date("document_date"),
    preparedBy: text("prepared_by"),
    reviewDueOn: date("review_due_on"),
    // Intentionally not cascading to the PGR: preserve provenance after deletion.
    originPgrId: uuid("origin_pgr_id"),
    originRevision: integer("origin_revision"),
    fingerprint: text("fingerprint").notNull(),
    supersedesSourceId: uuid("supersedes_source_id"),
    registeredBy: text("registered_by").notNull(),
    registeredAt: timestamp("registered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_medical_sources_identity").on(table.id, table.orgId, table.companyId),
    unique("uq_medical_sources_fingerprint").on(
      table.orgId,
      table.companyId,
      table.fingerprint,
    ),
    unique("uq_medical_sources_successor").on(
      table.orgId,
      table.companyId,
      table.supersedesSourceId,
    ),
    foreignKey({
      columns: [table.companyId, table.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.supersedesSourceId, table.orgId, table.companyId],
      foreignColumns: [table.id, table.orgId, table.companyId],
    }),
    check(
      "medical_sources_no_self_successor",
      sql`${table.supersedesSourceId} is null or ${table.supersedesSourceId} <> ${table.id}`,
    ),
    check("medical_sources_kind_check", sql`${table.kind} in ('internal','external')`),
    check(
      "medical_sources_external_provenance_check",
      sql`(${table.kind} = 'external' or (${table.documentDate} is null and ${table.preparedBy} is null and ${table.reviewDueOn} is null))
        and (${table.reviewDueOn} is null or ${table.documentDate} is null or ${table.reviewDueOn} >= ${table.documentDate})`,
    ),
    check(
      "medical_sources_origin_check",
      sql`(${table.kind} = 'internal' and ${table.originPgrId} is not null) or (${table.kind} = 'external' and ${table.originPgrId} is null)`,
    ),
    index("idx_medical_sources_company").on(
      table.orgId,
      table.companyId,
      table.registeredAt,
    ),
    pgPolicy("medical_sources_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("medical_sources_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(table.orgId, table.companyId, "medicine"),
      withCheck: companyModuleScope(table.orgId, table.companyId, "medicine"),
    }),
  ],
).enableRLS();

export const medicalRiskEntries = pgTable(
  "medical_risk_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    companyId: uuid("company_id").notNull(),
    sourceId: uuid("source_id").notNull(),
    content: jsonb("content").$type<MedicalRiskSnapshot>().notNull(),
    status: text("status").$type<MedicalRiskStatus>().notNull().default("pending"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
  },
  (table) => [
    unique("uq_medical_risk_entry_identity").on(table.id, table.orgId, table.companyId),
    foreignKey({
      columns: [table.sourceId, table.orgId, table.companyId],
      foreignColumns: [
        medicalRiskSources.id,
        medicalRiskSources.orgId,
        medicalRiskSources.companyId,
      ],
    }).onDelete("cascade"),
    index("idx_medical_risk_entries_source").on(table.orgId, table.sourceId),
    check(
      "medical_risk_entries_status_check",
      sql`${table.status} in ('pending','validated','rejected')`,
    ),
    check(
      "medical_risk_entries_reviewer_check",
      sql`(${table.status} = 'pending' and ${table.reviewedBy} is null and ${table.reviewedAt} is null) or (${table.status} in ('validated','rejected') and ${table.reviewedBy} is not null and ${table.reviewedAt} is not null)`,
    ),
    check(
      "medical_risk_entries_content_check",
      sql`jsonb_typeof(${table.content}) = 'object'`,
    ),
    pgPolicy("medical_risk_entries_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("medical_risk_entries_pending_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${table.status} = 'pending' and ${table.reviewedBy} is null and ${table.reviewedAt} is null`,
    }),
    pgPolicy("medical_risk_entries_authorized_review", {
      as: "restrictive",
      for: "update",
      to: appRuntimeRole,
      using: sql`exists (select 1 from public.professional_risk_authorizations a where a.org_id = ${table.orgId} and a.company_id = ${table.companyId} and a.user_id = current_setting('app.current_actor', true) and a.active = true)`,
      withCheck: sql`${table.reviewedBy} = current_setting('app.current_actor', true) and exists (select 1 from public.professional_risk_authorizations a where a.org_id = ${table.orgId} and a.company_id = ${table.companyId} and a.user_id = current_setting('app.current_actor', true) and a.active = true)`,
    }),
    pgPolicy("medical_risk_entries_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(table.orgId, table.companyId, "medicine"),
      withCheck: companyModuleScope(table.orgId, table.companyId, "medicine"),
    }),
  ],
).enableRLS();

export const medicalRiskEvents = pgTable(
  "medical_risk_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    companyId: uuid("company_id").notNull(),
    sourceId: uuid("source_id").notNull(),
    actor: text("actor").notNull(),
    event: text("event").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.sourceId, table.orgId, table.companyId],
      foreignColumns: [
        medicalRiskSources.id,
        medicalRiskSources.orgId,
        medicalRiskSources.companyId,
      ],
    }).onDelete("cascade"),
    index("idx_medical_risk_events_source").on(table.orgId, table.sourceId),
    pgPolicy("medical_risk_events_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("medical_risk_events_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(table.orgId, table.companyId, "medicine"),
      withCheck: companyModuleScope(table.orgId, table.companyId, "medicine"),
    }),
  ],
).enableRLS();
