import { pgTable, text, uuid, timestamp, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { companies } from "./companies";
import { addressColumns } from "./address-columns";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const workUnits = pgTable(
  "work_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contractNumber: text("contract_number"),
    description: text("description").notNull(),
    ...addressColumns(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_work_units_org_id").on(table.orgId),
    index("idx_work_units_company_id").on(table.companyId),
    pgPolicy("work_units_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type WorkUnit = InferSelectModel<typeof workUnits>;
export type NewWorkUnit = InferInsertModel<typeof workUnits>;
