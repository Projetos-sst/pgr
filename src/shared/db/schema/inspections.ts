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
import { companies } from "./companies";
import { workUnits } from "./work-units";
import { epiCatalog } from "./epis";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

function isolationPolicy(name: string) {
  return pgPolicy(name, {
    for: "all",
    to: appRuntimeRole,
    using: tenantScope,
    withCheck: tenantScope,
  });
}

// Tipo da inspeção/plano. Planos usam vehicular|equipment; safety é inspeção livre.
export const inspectionType = pgEnum("inspection_type", [
  "vehicular",
  "equipment",
  "safety",
]);
export const inspectionStatus = pgEnum("inspection_status", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);
export const vehicleType = pgEnum("vehicle_type", [
  "car",
  "motorcycle",
  "truck",
  "bus",
  "van",
  "utility",
  "pickup",
  "other",
]);
// Periodicidade de inspeção do veículo — base para derivar o vencimento (Status
// Regular/A vencer/Vencida) a partir da última inspeção.
export const inspectionFrequency = pgEnum("inspection_frequency", [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
]);
export const inspectionCategory = pgEnum("inspection_category", [
  "safety",
  "environment",
  "quality",
  "health",
  "other",
]);
export const occurrenceSeverity = pgEnum("occurrence_severity", [
  "low",
  "medium",
  "high",
]);

// ── Planos de inspeção (checklist reutilizável) ────────────────────────────
export const inspectionPlans = pgTable(
  "inspection_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    type: inspectionType("type").notNull(),
    subtype: text("subtype"),
    title: text("title").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_inspection_plans_org_id").on(table.orgId),
    isolationPolicy("inspection_plans_isolation"),
  ],
).enableRLS();

export const inspectionPlanItems = pgTable(
  "inspection_plan_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => inspectionPlans.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    defaultValue: boolean("default_value").notNull().default(false),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_inspection_plan_items_org_id").on(table.orgId),
    index("idx_inspection_plan_items_plan_id").on(table.planId),
    isolationPolicy("inspection_plan_items_isolation"),
  ],
).enableRLS();

// ── Veículos ───────────────────────────────────────────────────────────────
export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    plate: text("plate").notNull(),
    renavam: text("renavam"),
    brand: text("brand"),
    model: text("model"),
    type: vehicleType("type"),
    year: integer("year"),
    color: text("color"),
    owner: text("owner"),
    // Vínculo & inspeção (redesign): empresa/unidade proprietária + plano/frequência
    // que alimentam a derivação do vencimento na lista.
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    workUnitId: uuid("work_unit_id").references(() => workUnits.id, {
      onDelete: "set null",
    }),
    inspectionPlanId: uuid("inspection_plan_id").references(() => inspectionPlans.id, {
      onDelete: "set null",
    }),
    inspectionFrequency: inspectionFrequency("inspection_frequency"),
    initialKm: integer("initial_km").notNull().default(0),
    photoPath: text("photo_path"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_vehicles_org_id").on(table.orgId),
    index("idx_vehicles_company_id").on(table.orgId, table.companyId),
    uniqueIndex("uq_vehicles_org_id_plate").on(table.orgId, table.plate),
    check("vehicles_initial_km_check", sql`${table.initialKm} >= 0`),
    check(
      "vehicles_year_check",
      sql`${table.year} is null or (${table.year} between 1900 and 2100)`,
    ),
    isolationPolicy("vehicles_isolation"),
  ],
).enableRLS();

// ── Inspeção (cabeçalho polimórfico) ────────────────────────────────────────
export const inspections = pgTable(
  "inspections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    type: inspectionType("type").notNull(),
    status: inspectionStatus("status").notNull().default("pending"),
    inspectedAt: date("inspected_at").notNull(),
    planId: uuid("plan_id").references(() => inspectionPlans.id, {
      onDelete: "set null",
    }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    equipmentCatalogId: uuid("equipment_catalog_id").references(() => epiCatalog.id, {
      onDelete: "set null",
    }),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    // Comuns / veiculares
    responsible: text("responsible"),
    driverName: text("driver_name"),
    driverLicense: text("driver_license"),
    currentKm: integer("current_km"),
    route: text("route"),
    // Segurança
    category: inspectionCategory("category"),
    planned: boolean("planned"),
    area: text("area"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_inspections_org_id").on(table.orgId),
    index("idx_inspections_org_type").on(table.orgId, table.type),
    index("idx_inspections_vehicle_id").on(table.vehicleId),
    isolationPolicy("inspections_isolation"),
  ],
).enableRLS();

export const inspectionItemResponses = pgTable(
  "inspection_item_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    inspectionId: uuid("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    planItemId: uuid("plan_item_id")
      .notNull()
      .references(() => inspectionPlanItems.id, { onDelete: "cascade" }),
    value: boolean("value"),
    observation: text("observation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_inspection_item_responses_org_id").on(table.orgId),
    uniqueIndex("uq_inspection_item_responses_inspection_item").on(
      table.inspectionId,
      table.planItemId,
    ),
    isolationPolicy("inspection_item_responses_isolation"),
  ],
).enableRLS();

export const inspectionOccurrences = pgTable(
  "inspection_occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    inspectionId: uuid("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    severity: occurrenceSeverity("severity"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_inspection_occurrences_org_id").on(table.orgId),
    index("idx_inspection_occurrences_inspection_id").on(table.inspectionId),
    isolationPolicy("inspection_occurrences_isolation"),
  ],
).enableRLS();

export type InspectionPlan = InferSelectModel<typeof inspectionPlans>;
export type NewInspectionPlan = InferInsertModel<typeof inspectionPlans>;
export type InspectionPlanItem = InferSelectModel<typeof inspectionPlanItems>;
export type NewInspectionPlanItem = InferInsertModel<typeof inspectionPlanItems>;
export type Vehicle = InferSelectModel<typeof vehicles>;
export type NewVehicle = InferInsertModel<typeof vehicles>;
export type Inspection = InferSelectModel<typeof inspections>;
export type NewInspection = InferInsertModel<typeof inspections>;
export type InspectionStatus = Inspection["status"];
export type InspectionItemResponse = InferSelectModel<typeof inspectionItemResponses>;
export type NewInspectionItemResponse = InferInsertModel<typeof inspectionItemResponses>;
export type InspectionOccurrence = InferSelectModel<typeof inspectionOccurrences>;
export type NewInspectionOccurrence = InferInsertModel<typeof inspectionOccurrences>;
