import {
  pgTable,
  pgEnum,
  text,
  uuid,
  date,
  timestamp,
  index,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { employees } from "./employees";
import { medicos } from "./medicos";
import { companyModuleScope } from "./module-policy";

export const examType = pgEnum("exam_type", [
  "admissional",
  "periodic",
  "change_of_function",
  "return_to_work",
  "dismissal",
]);

export const examAptitude = pgEnum("exam_aptitude", [
  "fit",
  "fit_with_restrictions",
  "unfit",
]);

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

/**
 * Exames ocupacionais / ASO por funcionário (Gestão de Saúde Ocupacional). A
 * validade (vigente/a vencer/vencido) é DERIVADA na leitura a partir de
 * `valid_until` (nullable — ex.: demissional pode não ter validade). `doctor_id`
 * usa ON DELETE SET NULL: excluir um médico não bloqueia nem apaga o exame.
 */
export const healthExams = pgTable(
  "health_exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id").references(() => medicos.id, { onDelete: "set null" }),
    examType: examType("exam_type").notNull(),
    performedAt: date("performed_at").notNull(),
    validUntil: date("valid_until"),
    aptitude: examAptitude("aptitude").notNull(),
    notes: text("notes"),
    certificatePath: text("certificate_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_health_exams_org_id").on(table.orgId),
    pgPolicy("health_exams_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: sql`exists (select 1 from public.employees e where e.id = ${table.employeeId} and e.org_id = ${table.orgId} and ${companyModuleScope(table.orgId, sql`e.company_id`, "medicine")})`,
      withCheck: sql`exists (select 1 from public.employees e where e.id = ${table.employeeId} and e.org_id = ${table.orgId} and ${companyModuleScope(table.orgId, sql`e.company_id`, "medicine")})`,
    }),
    index("idx_health_exams_employee_id").on(table.employeeId),
    index("idx_health_exams_doctor_id").on(table.doctorId),
    pgPolicy("health_exams_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type HealthExam = InferSelectModel<typeof healthExams>;
export type NewHealthExam = InferInsertModel<typeof healthExams>;
