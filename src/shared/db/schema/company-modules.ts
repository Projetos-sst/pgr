import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  unique,
  check,
  pgPolicy,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";

import { appRuntimeRole } from "../roles";
import { companies } from "./companies";
import { actorCompanyScope, actorModuleScope } from "./access-scope-policy";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;
const actor = sql`current_setting('app.current_actor', true)`;
/** Só o administrador do escritório (owner / org:admin) altera serviços — também no banco. */
const officeOwner = (orgId: unknown) =>
  sql`exists (select 1 from public.org_memberships om where om.org_id = ${orgId}
    and om.user_id = ${actor} and om.role in ('owner','org:admin'))`;

export const companyModules = pgTable(
  "company_modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    companyId: uuid("company_id").notNull(),
    module: text("module").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_company_modules_company_module").on(
      table.orgId,
      table.companyId,
      table.module,
    ),
    check("company_modules_module_check", sql`${table.module} in ('pgr', 'medicine')`),
    foreignKey({
      columns: [table.companyId, table.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    pgPolicy("company_modules_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("company_modules_actor_scope", {
      as: "restrictive",
      for: "select",
      to: appRuntimeRole,
      using: actorModuleScope(table.companyId, table.module),
    }),
    pgPolicy("company_modules_owner_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: officeOwner(table.orgId),
    }),
    pgPolicy("company_modules_owner_update", {
      as: "restrictive",
      for: "update",
      to: appRuntimeRole,
      using: officeOwner(table.orgId),
      withCheck: officeOwner(table.orgId),
    }),
  ],
).enableRLS();

/** Append-only: runtime gets SELECT/INSERT, never UPDATE/DELETE. */
export const companyModuleEvents = pgTable(
  "company_module_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    companyId: uuid("company_id").notNull(),
    module: text("module").notNull(),
    previousEnabled: boolean("previous_enabled").notNull(),
    enabled: boolean("enabled").notNull(),
    changedBy: text("changed_by").notNull(),
    reason: text("reason").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy("company_module_events_actor_scope", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: actorCompanyScope(table.companyId),
    }),
    index("idx_company_module_events_company").on(table.orgId, table.companyId),
    check(
      "company_module_events_module_check",
      sql`${table.module} in ('pgr', 'medicine')`,
    ),
    foreignKey({
      columns: [table.companyId, table.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    pgPolicy("company_module_events_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    // O evento registra o próprio ator da sessão, que precisa ser administrador.
    pgPolicy("company_module_events_owner_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${table.changedBy} = ${actor} and ${officeOwner(table.orgId)}`,
    }),
  ],
).enableRLS();
