import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  check,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { appRuntimeRole } from "../roles";
import { companies } from "./companies";
import { workUnits } from "./work-units";
import { ges } from "./ges";
import { epiCatalog } from "./epis";
import { companyModuleScope } from "./module-policy";
import { actorWorkUnitScope } from "./access-scope-policy";
const tenant = sql`org_id=current_setting('app.current_org',true)`;
export const machineInstallations = pgTable(
  "machine_installations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    workUnitId: uuid("work_unit_id")
      .notNull()
      .references(() => workUnits.id, { onDelete: "restrict" }),
    gesId: uuid("ges_id").references(() => ges.id, { onDelete: "restrict" }),
    catalogId: uuid("catalog_id")
      .notNull()
      .references(() => epiCatalog.id, { onDelete: "restrict" }),
    catalogName: text("catalog_name").notNull(),
    manufacturer: text("manufacturer"),
    mode: text("mode").notNull(),
    quantity: integer("quantity").notNull(),
    identifier: text("identifier"),
    description: text("description").notNull(),
    operatingConditions: text("operating_conditions"),
    safetyMeasures: text("safety_measures"),
    maintenanceNotes: text("maintenance_notes"),
    responsible: text("responsible"),
    active: boolean("active").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    pgPolicy("machine_installations_actor_scope", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: actorWorkUnitScope(t.companyId, t.workUnitId),
    }),
    index("idx_machine_installations_context").on(
      t.orgId,
      t.companyId,
      t.workUnitId,
      t.gesId,
    ),
    check(
      "machine_installations_quantity",
      sql`${t.quantity}>0 and ${t.quantity}<=100000`,
    ),
    check(
      "machine_installations_mode",
      sql`${t.mode} in ('individual','group') and (${t.mode}<>'individual' or (${t.quantity}=1 and length(trim(${t.identifier}))>0 and ${t.identifier} is not null))`,
    ),
    pgPolicy("machine_installations_tenant", {
      for: "all",
      to: appRuntimeRole,
      using: tenant,
      withCheck: tenant,
    }),
    pgPolicy("machine_installations_module", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "pgr"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "pgr"),
    }),
    pgPolicy("machine_installations_context", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: sql`exists(select 1 from public.work_units w where w.id=${t.workUnitId} and w.org_id=${t.orgId} and w.company_id=${t.companyId})`,
      withCheck: sql`exists(select 1 from public.work_units w where w.id=${t.workUnitId} and w.org_id=${t.orgId} and w.company_id=${t.companyId}) and (${t.gesId} is null or exists(select 1 from public.ges g where g.id=${t.gesId} and g.org_id=${t.orgId} and g.company_id=${t.companyId} and g.work_unit_id=${t.workUnitId})) and exists(select 1 from public.epi_catalog c where c.id=${t.catalogId} and c.org_id=${t.orgId} and c.type='machine' and (c.company_id is null or c.company_id=${t.companyId}))`,
    }),
  ],
).enableRLS();
export const machineInstallationEvents = pgTable(
  "machine_installation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    companyId: uuid("company_id").notNull(),
    installationId: uuid("installation_id")
      .notNull()
      .references(() => machineInstallations.id, { onDelete: "cascade" }),
    actor: text("actor").notNull(),
    event: text("event").notNull(),
    reason: text("reason").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_machine_installation_events").on(t.orgId, t.installationId, t.createdAt),
    pgPolicy("machine_installation_events_tenant", {
      for: "all",
      to: appRuntimeRole,
      using: tenant,
      withCheck: tenant,
    }),
    pgPolicy("machine_installation_events_parent", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: sql`exists(select 1 from public.machine_installations m where m.id=${t.installationId} and m.org_id=${t.orgId} and m.company_id=${t.companyId})`,
      withCheck: sql`exists(select 1 from public.machine_installations m where m.id=${t.installationId} and m.org_id=${t.orgId} and m.company_id=${t.companyId})`,
    }),
  ],
).enableRLS();
