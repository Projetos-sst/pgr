import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  unique,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import type { BasicOfferInput } from "@/shared/domains/pgr/basic-offer";
const tenant = sql`org_id=current_setting('app.current_org',true)`;
const owner = sql`exists(select 1 from public.org_memberships m where m.org_id=current_setting('app.current_org',true) and m.user_id=current_setting('app.current_actor',true) and m.role in ('owner','org:admin'))`;
export const pgrBasicOfferVersions = pgTable(
  "pgr_basic_offer_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    data: jsonb("data").$type<BasicOfferInput>().notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_pgr_basic_offer_version").on(t.orgId, t.version),
    pgPolicy("basic_offer_versions_tenant", {
      for: "all",
      to: appRuntimeRole,
      using: tenant,
      withCheck: tenant,
    }),
    pgPolicy("basic_offer_versions_owner", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${owner} and ${t.createdBy}=current_setting('app.current_actor',true)`,
    }),
  ],
).enableRLS();
export const pgrBasicOfferPublication = pgTable(
  "pgr_basic_offer_publication",
  {
    orgId: text("org_id")
      .primaryKey()
      .references(() => orgs.id, { onDelete: "cascade" }),
    activeVersionId: uuid("active_version_id").references(
      () => pgrBasicOfferVersions.id,
      { onDelete: "restrict" },
    ),
    changedBy: text("changed_by").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    pgPolicy("basic_offer_publication_tenant", {
      for: "all",
      to: appRuntimeRole,
      using: tenant,
      withCheck: tenant,
    }),
    pgPolicy("basic_offer_publication_owner_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${owner} and ${t.changedBy}=current_setting('app.current_actor',true) and (${t.activeVersionId} is null or exists(select 1 from public.pgr_basic_offer_versions v where v.id=${t.activeVersionId} and v.org_id=${t.orgId}))`,
    }),
    pgPolicy("basic_offer_publication_owner_update", {
      as: "restrictive",
      for: "update",
      to: appRuntimeRole,
      using: owner,
      withCheck: sql`${owner} and ${t.changedBy}=current_setting('app.current_actor',true) and (${t.activeVersionId} is null or exists(select 1 from public.pgr_basic_offer_versions v where v.id=${t.activeVersionId} and v.org_id=${t.orgId}))`,
    }),
  ],
).enableRLS();
export const pgrBasicOfferEvents = pgTable(
  "pgr_basic_offer_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    versionId: uuid("version_id")
      .notNull()
      .references(() => pgrBasicOfferVersions.id, { onDelete: "restrict" }),
    event: text("event").notNull(),
    actor: text("actor").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_basic_offer_events").on(t.orgId, t.createdAt),
    pgPolicy("basic_offer_events_tenant", {
      for: "all",
      to: appRuntimeRole,
      using: tenant,
      withCheck: tenant,
    }),
    pgPolicy("basic_offer_events_owner", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${owner} and ${t.actor}=current_setting('app.current_actor',true) and exists(select 1 from public.pgr_basic_offer_versions v where v.id=${t.versionId} and v.org_id=${t.orgId})`,
    }),
  ],
).enableRLS();
