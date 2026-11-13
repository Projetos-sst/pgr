import {
  pgTable,
  text,
  uuid,
  integer,
  boolean,
  numeric,
  date,
  timestamp,
  index,
  uniqueIndex,
  pgPolicy,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { companies } from "./companies";
import { employees } from "./employees";
import { actorCompanyScope } from "./access-scope-policy";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const accidentType = pgEnum("accident_type", [
  "typical",
  "commute",
  "occupational_disease",
]);
export const accidentCategory = pgEnum("accident_category", [
  "with_leave",
  "without_leave",
  "fatal",
]);
export const accidentSeverity = pgEnum("accident_severity", [
  "no_injury",
  "minor",
  "moderate",
  "severe",
  "fatal",
]);
export const accidentStatus = pgEnum("accident_status", [
  "registered",
  "awaiting_planning",
  "awaiting_completion",
  "completed",
  "cancelled",
]);

// Incidentes/Acidentes — DADO DE SAÚDE (P0): só office staff; nunca em log/audit/IA/público.
// CAT é registro INTERNO: campos código/descrição são textuais e opcionais; sem emissão S-2210.
export const accidents = pgTable(
  "accidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    // Número sequencial por tenant (max+1 sob lock da linha de orgs; ver repositório).
    number: integer("number").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").references(() => employees.id, {
      onDelete: "set null",
    }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    type: accidentType("type").notNull(),
    category: accidentCategory("category").notNull(),
    severity: accidentSeverity("severity").notNull(),
    status: accidentStatus("status").notNull().default("registered"),
    location: text("location"),
    description: text("description"),
    awayFromWork: boolean("away_from_work"),
    workedHours: numeric("worked_hours"),
    hospital: text("hospital"),
    injuryNatureCode: text("injury_nature_code"),
    injuryNatureDescription: text("injury_nature_description"),
    bodyPartCode: text("body_part_code"),
    bodyPartDescription: text("body_part_description"),
    causativeAgentCode: text("causative_agent_code"),
    causativeAgentDescription: text("causative_agent_description"),
    causes: text("causes"),
    environmentalImpact: text("environmental_impact"),
    materialLoss: text("material_loss"),
    thirdParties: text("third_parties"),
    fatalityPotential: boolean("fatality_potential"),
    responsibleArea: text("responsible_area"),
    activityProcedure: text("activity_procedure"),
    witnesses: text("witnesses"),
    investigationNotes: text("investigation_notes"),
    catNumber: text("cat_number"),
    catIssuedAt: date("cat_issued_at"),
    completionJustification: text("completion_justification"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy("accidents_actor_scope", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: actorCompanyScope(table.companyId),
    }),
    index("idx_accidents_org_id").on(table.orgId),
    index("idx_accidents_org_status").on(table.orgId, table.status),
    index("idx_accidents_company").on(table.orgId, table.companyId),
    index("idx_accidents_occurred").on(table.orgId, table.occurredAt),
    uniqueIndex("uq_accidents_org_id_number").on(table.orgId, table.number),
    pgPolicy("accidents_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type Accident = InferSelectModel<typeof accidents>;
export type NewAccident = InferInsertModel<typeof accidents>;
