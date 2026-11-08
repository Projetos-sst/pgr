import {
  pgTable,
  text,
  uuid,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  unique,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { companies } from "./companies";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const jobRoles = pgTable(
  "job_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    cbo: text("cbo"),
    // Setor (#193) — coluna texto livre (decisão R4: SESMT/Obra Civil/etc. não são GES).
    sector: text("sector"),
    workSchedule: text("work_schedule"),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_job_roles_org_id").on(table.orgId),
    index("idx_job_roles_company_id").on(table.companyId),
    uniqueIndex("uq_job_roles_org_company_title").on(
      table.orgId,
      table.companyId,
      table.title,
    ),
    // Alvo das FKs compostas que prendem a função ao mesmo tenant e à mesma empresa
    // (ex.: declaração de inexistência de riscos da Medicina, NOB-112/NOB-156).
    unique("uq_job_roles_id_scope").on(table.id, table.orgId, table.companyId),
    pgPolicy("job_roles_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type JobRole = InferSelectModel<typeof jobRoles>;
export type NewJobRole = InferInsertModel<typeof jobRoles>;
