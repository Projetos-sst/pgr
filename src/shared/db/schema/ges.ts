import {
  pgTable,
  text,
  uuid,
  numeric,
  timestamp,
  index,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { companies } from "./companies";
import { workUnits } from "./work-units";
import { actorWorkUnitScope } from "./access-scope-policy";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const ges = pgTable(
  "ges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    workUnitId: uuid("work_unit_id")
      .notNull()
      .references(() => workUnits.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    processDescription: text("process_description"),
    constructionType: text("construction_type"),
    ceilingHeight: numeric("ceiling_height"),
    floor: text("floor"),
    roof: text("roof"),
    lighting: text("lighting"),
    ventilation: text("ventilation"),
    otherCharacteristics: text("other_characteristics"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy("ges_actor_scope", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: actorWorkUnitScope(table.companyId, table.workUnitId),
    }),
    index("idx_ges_org_id").on(table.orgId),
    index("idx_ges_company_id").on(table.companyId),
    index("idx_ges_work_unit_id").on(table.workUnitId),
    pgPolicy("ges_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type Ges = InferSelectModel<typeof ges>;
export type NewGes = InferInsertModel<typeof ges>;
