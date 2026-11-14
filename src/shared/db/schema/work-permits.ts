import {
  pgTable,
  pgEnum,
  text,
  uuid,
  timestamp,
  date,
  index,
  uniqueIndex,
  check,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { companies } from "./companies";
import { actorCompanyScope, officeWideOr } from "./access-scope-policy";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

function isolationPolicy(name: string) {
  return pgPolicy(name, {
    for: "all",
    to: appRuntimeRole,
    using: tenantScope,
    withCheck: tenantScope,
  });
}

// Tipo de trabalho autorizado pela PT (NR-33/NR-35/NR-10/NR-18 etc).
export const workPermitType = pgEnum("work_permit_type", [
  "hot_work",
  "confined_space",
  "height",
  "electrical",
  "excavation",
  "cold_work",
  "other",
]);

export const workPermitStatus = pgEnum("work_permit_status", [
  "draft",
  "active",
  "suspended",
  "closed",
  "cancelled",
]);

export const workPermits = pgTable(
  "work_permits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    type: workPermitType("type").notNull(),
    status: workPermitStatus("status").notNull().default("draft"),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    area: text("area"),
    description: text("description").notNull(),
    validFrom: date("valid_from").notNull(),
    validUntil: date("valid_until").notNull(),
    requestedBy: text("requested_by"),
    approvedBy: text("approved_by"),
    precautions: text("precautions"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy("work_permits_actor_scope", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: officeWideOr(table.companyId, actorCompanyScope(table.companyId)),
    }),
    index("idx_work_permits_org_id").on(table.orgId),
    index("idx_work_permits_org_status").on(table.orgId, table.status),
    uniqueIndex("uq_work_permits_org_number").on(table.orgId, table.number),
    check(
      "work_permits_valid_range_check",
      sql`${table.validUntil} >= ${table.validFrom}`,
    ),
    isolationPolicy("work_permits_isolation"),
  ],
).enableRLS();

export type WorkPermit = InferSelectModel<typeof workPermits>;
export type NewWorkPermit = InferInsertModel<typeof workPermits>;
export type WorkPermitStatusValue = WorkPermit["status"];
export type WorkPermitTypeValue = WorkPermit["type"];
