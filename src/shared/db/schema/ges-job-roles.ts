import {
  pgTable,
  text,
  uuid,
  integer,
  timestamp,
  index,
  uniqueIndex,
  check,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { ges } from "./ges";
import { jobRoles } from "./job-roles";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const gesJobRoles = pgTable(
  "ges_job_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    gesId: uuid("ges_id")
      .notNull()
      .references(() => ges.id, { onDelete: "cascade" }),
    jobRoleId: uuid("job_role_id")
      .notNull()
      .references(() => jobRoles.id, { onDelete: "cascade" }),
    workerCount: integer("worker_count").notNull(),
    workSchedule: text("work_schedule"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_ges_job_roles_org_id").on(table.orgId),
    index("idx_ges_job_roles_ges_id").on(table.gesId),
    index("idx_ges_job_roles_job_role_id").on(table.jobRoleId),
    uniqueIndex("uq_ges_job_roles_org_ges_role").on(
      table.orgId,
      table.gesId,
      table.jobRoleId,
    ),
    check("ges_job_roles_worker_count_check", sql`worker_count > 0`),
    pgPolicy("ges_job_roles_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type GesJobRole = InferSelectModel<typeof gesJobRoles>;
export type NewGesJobRole = InferInsertModel<typeof gesJobRoles>;
