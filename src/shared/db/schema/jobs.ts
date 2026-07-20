import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  jsonb,
  timestamp,
  index,
  check,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const jobType = pgEnum("job_type", ["pdf_batch"]);

export const jobStatus = pgEnum("job_status", [
  "pending",
  "processing",
  "done",
  "failed",
]);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    jobType: jobType("job_type").notNull(),
    status: jobStatus("status").notNull().default("pending"),
    payload: jsonb("payload")
      .notNull()
      .default(sql`'{}'::jsonb`),
    result: jsonb("result"),
    attempts: integer("attempts").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_jobs_org_id").on(table.orgId),
    index("idx_jobs_status_created_at").on(table.status, table.createdAt),
    check("jobs_attempts_check", sql`attempts >= 0`),
    pgPolicy("jobs_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type Job = InferSelectModel<typeof jobs>;
export type NewJob = InferInsertModel<typeof jobs>;
