import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  boolean,
  date,
  timestamp,
  index,
  uniqueIndex,
  check,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { employees } from "./employees";
import { jobRoles } from "./job-roles";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

// Periodicidade de reciclagem (D3). Enum Postgres é forward-only; rótulos PT só
// na UI. `single` = realização única, sem validade (`valid_until` null).
export const trainingPeriodicity = pgEnum("training_periodicity", [
  "annual",
  "biennial",
  "triennial",
  "quinquennial",
  "single",
]);

/**
 * Catálogo de treinamentos oferecidos pelo escritório (5 campos ePGR: Nome,
 * Norma de Referência, Carga Horária, Periodicidade, Descrição). Base
 * referenciada por realizações (US2) e por obrigatórios por função (US4).
 */
export const trainingCatalog = pgTable(
  "training_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    // Código sequencial por tenant (max+1 sob lock de orgs; ver repositório) → "TR-0201".
    number: integer("number").notNull(),
    name: text("name").notNull(),
    referenceNorm: text("reference_norm"),
    workloadHours: integer("workload_hours").notNull(),
    periodicity: trainingPeriodicity("periodicity").notNull(),
    // Vigência do item de catálogo (Vigente/Inativo no redesign).
    isActive: boolean("is_active").notNull().default(true),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_training_catalog_org_id").on(table.orgId),
    uniqueIndex("uq_training_catalog_org_name").on(table.orgId, table.name),
    uniqueIndex("uq_training_catalog_org_number").on(table.orgId, table.number),
    check("training_catalog_workload_hours_check", sql`workload_hours > 0`),
    pgPolicy("training_catalog_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

/**
 * Realização de um treinamento por um funcionário — histórico: reciclagem gera
 * novas linhas do mesmo par (funcionário, treinamento). `valid_until` é
 * calculado por D1 na escrita e PERSISTIDO (D6); `certificate_path` é só texto
 * (D4 — sem GED/upload). RESTRICT sobre o catálogo: item em uso não some.
 */
export const trainingRecords = pgTable(
  "training_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    trainingId: uuid("training_id")
      .notNull()
      .references(() => trainingCatalog.id, { onDelete: "restrict" }),
    completedAt: date("completed_at").notNull(),
    validUntil: date("valid_until"),
    certificatePath: text("certificate_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_training_records_org_id").on(table.orgId),
    index("idx_training_records_employee_id").on(table.employeeId),
    index("idx_training_records_training_id").on(table.trainingId),
    pgPolicy("training_records_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

/**
 * Vínculo que declara um treinamento como obrigatório para uma função (US4).
 * UNIQUE por (org, função, treinamento) → add idempotente. CASCADE com a
 * função; RESTRICT sobre o catálogo (vínculo bloqueia exclusão do item).
 */
export const jobRoleRequiredTrainings = pgTable(
  "job_role_required_trainings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    jobRoleId: uuid("job_role_id")
      .notNull()
      .references(() => jobRoles.id, { onDelete: "cascade" }),
    trainingId: uuid("training_id")
      .notNull()
      .references(() => trainingCatalog.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_job_role_required_trainings_org_id").on(table.orgId),
    index("idx_job_role_required_trainings_job_role_id").on(table.jobRoleId),
    index("idx_job_role_required_trainings_training_id").on(table.trainingId),
    uniqueIndex("uq_job_role_required_trainings_org_role_training").on(
      table.orgId,
      table.jobRoleId,
      table.trainingId,
    ),
    pgPolicy("job_role_required_trainings_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type TrainingCatalog = InferSelectModel<typeof trainingCatalog>;
export type NewTrainingCatalog = InferInsertModel<typeof trainingCatalog>;
export type TrainingRecord = InferSelectModel<typeof trainingRecords>;
export type NewTrainingRecord = InferInsertModel<typeof trainingRecords>;
export type JobRoleRequiredTraining = InferSelectModel<typeof jobRoleRequiredTrainings>;
export type NewJobRoleRequiredTraining = InferInsertModel<
  typeof jobRoleRequiredTrainings
>;
