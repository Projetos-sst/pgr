import {
  pgTable,
  pgEnum,
  text,
  uuid,
  date,
  timestamp,
  index,
  pgPolicy,
  foreignKey,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { companies } from "./companies";
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
 * usa ON DELETE NO ACTION (0081; antes SET NULL): excluir o médico examinador não pode
 * apagar em silêncio quem examinou — a exclusão é recusada (IN_USE) e o cadastro é inativado.
 * `company_id` (NOB-152, MED-07) é a empresa onde o exame foi realizado:
 * - `registered`: gravada pelo servidor na criação, a partir do vínculo do funcionário;
 * - `confirmed`: exame antigo cuja origem o responsável confirmou, com justificativa e autoria;
 * - nula: exame anterior ao controle, com origem não comprovada. Não serve ao ASO.
 * Não acompanha transferências e, uma vez registrada, não muda (trigger).
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
    // Preenchida pelo trigger `health_exams_set_company` quando o INSERT não a informa.
    companyId: uuid("company_id"),
    companyOrigin: text("company_origin").$type<"registered" | "confirmed">(),
    companyOriginConfirmedBy: text("company_origin_confirmed_by"),
    companyOriginConfirmedAt: timestamp("company_origin_confirmed_at", {
      withTimezone: true,
    }),
    companyOriginNote: text("company_origin_note"),
    doctorId: uuid("doctor_id").references(() => medicos.id, { onDelete: "no action" }),
    examType: examType("exam_type").notNull(),
    performedAt: date("performed_at").notNull(),
    validUntil: date("valid_until"),
    aptitude: examAptitude("aptitude").notNull(),
    /**
     * Desativada (NOB-155, DT-21): as observações clínicas foram migradas pela 0067 para o
     * prontuário segregado (`health_exam_clinical_notes`), e o CHECK `ck_health_exams_notes_retired`
     * mantém a coluna vazia. Nenhum código lê nem grava; a remoção física fica para uma migration
     * posterior, quando nenhuma versão do app em uso selecionar a coluna.
     */
    notes: text("notes"),
    certificatePath: text("certificate_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_health_exams_org_id").on(table.orgId),
    unique("uq_health_exams_identity").on(table.id, table.orgId, table.companyId),
    // Alvo das FKs compostas do prontuário (NOB-155), que vale também para exame sem origem.
    unique("uq_health_exams_id_org").on(table.id, table.orgId),
    check("ck_health_exams_notes_retired", sql`${table.notes} is null`),
    foreignKey({
      columns: [table.companyId, table.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    index("idx_health_exams_company_id").on(table.orgId, table.companyId),
    check(
      "ck_health_exams_company_origin",
      sql`(${table.companyId} is null and ${table.companyOrigin} is null) or (${table.companyId} is not null and ${table.companyOrigin} in ('registered','confirmed'))`,
    ),
    check(
      "ck_health_exams_company_confirmation",
      sql`(${table.companyOrigin} = 'confirmed') = (${table.companyOriginConfirmedBy} is not null and ${table.companyOriginConfirmedAt} is not null and ${table.companyOriginNote} is not null)`,
    ),
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
/** Exame como a aplicação lê: sem a coluna desativada `notes` (NOB-155). */
export type HealthExamRecord = Omit<HealthExam, "notes">;

/**
 * Exames complementares realizados no exame ocupacional (NOB-152, NR-7 7.5.19.1 d): código da
 * Tabela 27 do eSocial e data. Só a indicação e a data, nunca o resultado clínico. Herdam a
 * empresa do exame (FK composta), então não migram com o funcionário (MED-07).
 */
export const healthExamProcedures = pgTable(
  "health_exam_procedures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    companyId: uuid("company_id").notNull(),
    healthExamId: uuid("health_exam_id").notNull(),
    procedureCode: text("procedure_code").notNull(),
    otherDescription: text("other_description"),
    performedAt: date("performed_at").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.healthExamId, table.orgId, table.companyId],
      foreignColumns: [healthExams.id, healthExams.orgId, healthExams.companyId],
    }).onDelete("cascade"),
    unique("uq_health_exam_procedures")
      .on(
        table.orgId,
        table.healthExamId,
        table.procedureCode,
        table.performedAt,
        table.otherDescription,
      )
      .nullsNotDistinct(),
    index("idx_health_exam_procedures_exam").on(table.orgId, table.healthExamId),
    check("ck_health_exam_procedures_code", sql`${table.procedureCode} ~ '^[0-9]{4}$'`),
    check(
      "ck_health_exam_procedures_other",
      sql`(${table.procedureCode} = '9999') = (${table.otherDescription} is not null)`,
    ),
    pgPolicy("health_exam_procedures_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("health_exam_procedures_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(table.orgId, table.companyId, "medicine"),
      withCheck: companyModuleScope(table.orgId, table.companyId, "medicine"),
    }),
    pgPolicy("health_exam_procedures_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${table.createdBy} = current_setting('app.current_actor', true)`,
    }),
  ],
).enableRLS();

export type HealthExamProcedure = InferSelectModel<typeof healthExamProcedures>;
