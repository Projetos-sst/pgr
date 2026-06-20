import {
  pgTable,
  pgEnum,
  text,
  uuid,
  date,
  timestamp,
  index,
  uniqueIndex,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { companies } from "./companies";
import { ges } from "./ges";
import { jobRoles } from "./job-roles";
import { addressColumns } from "./address-columns";

export const employeeSex = pgEnum("employee_sex", ["male", "female", "not_informed"]);
export const maritalStatus = pgEnum("marital_status", [
  "single",
  "married",
  "divorced",
  "widowed",
  "stable_union",
]);
export const employeeStatus = pgEnum("employee_status", [
  "active",
  "on_leave",
  "dismissed",
]);

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    gesId: uuid("ges_id").references(() => ges.id, { onDelete: "set null" }),
    jobRoleId: uuid("job_role_id").references(() => jobRoles.id, {
      onDelete: "set null",
    }),
    fullName: text("full_name").notNull(),
    cpf: text("cpf").notNull(),
    birthDate: date("birth_date"),
    sex: employeeSex("sex"),
    maritalStatus: maritalStatus("marital_status"),
    phone: text("phone"),
    email: text("email"),
    rg: text("rg"),
    badgeNumber: text("badge_number"),
    badgeValidUntil: date("badge_valid_until"),
    registration: text("registration"),
    bloodType: text("blood_type"),
    admissionDate: date("admission_date"),
    dismissalDate: date("dismissal_date"),
    ...addressColumns(),
    photoPath: text("photo_path"),
    status: employeeStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_employees_org_id").on(table.orgId),
    index("idx_employees_company_id").on(table.companyId),
    index("idx_employees_ges_id").on(table.gesId),
    index("idx_employees_job_role_id").on(table.jobRoleId),
    uniqueIndex("uq_employees_org_cpf").on(table.orgId, table.cpf),
    pgPolicy("employees_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type Employee = InferSelectModel<typeof employees>;
export type NewEmployee = InferInsertModel<typeof employees>;
