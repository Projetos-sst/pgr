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

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

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
  ],
).enableRLS();
