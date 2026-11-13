import {
  pgTable,
  text,
  uuid,
  integer,
  boolean,
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
import { employees } from "./employees";
import { workUnits } from "./work-units";
// Reuso do enum de tipo de exame ocupacional (health-exams): os valores do mockup
// de "Tipo de OS" (Admissional/Periódico/Mudança de Função/Retorno/Demissional) são
// exatamente os tipos de ASO — evita um enum duplicado.
import { examType } from "./health-exams";
import { visibleWorkUnit } from "./access-scope-policy";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const serviceOrderStatus = pgEnum("service_order_status", [
  "open",
  "in_progress",
  "completed",
  "cancelled",
]);

export const serviceOrders = pgTable(
  "service_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    // Número calculado no servidor (max+1 por tenant, sob lock da linha de orgs).
    number: integer("number").notNull(),
    title: text("title").notNull(),
    // Tipo da OS de Segurança (NR-01 1.4.1) — reusa o enum exam_type. Nullable:
    // OSs antigas não têm tipo e o rascunho pode ser salvo antes de defini-lo.
    osType: examType("os_type"),
    assignedEmployeeId: uuid("assigned_employee_id").references(() => employees.id, {
      onDelete: "set null",
    }),
    // Unidade/obra à qual a OS se refere (escolha do usuário no formulário).
    workUnitId: uuid("work_unit_id").references(() => workUnits.id, {
      onDelete: "set null",
    }),
    openedAt: date("opened_at").notNull(),
    dueDate: date("due_date"),
    closedAt: date("closed_at"),
    status: serviceOrderStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy("service_orders_actor_scope", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: visibleWorkUnit(table.workUnitId),
    }),
    index("idx_service_orders_org_id").on(table.orgId),
    index("idx_service_orders_org_status").on(table.orgId, table.status),
    index("idx_service_orders_assigned").on(table.orgId, table.assignedEmployeeId),
    index("idx_service_orders_work_unit").on(table.orgId, table.workUnitId),
    uniqueIndex("uq_service_orders_org_id_number").on(table.orgId, table.number),
    pgPolicy("service_orders_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export const serviceOrderItems = pgTable(
  "service_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Carrega o tenant próprio (não confia só na FK do pai).
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    serviceOrderId: uuid("service_order_id")
      .notNull()
      .references(() => serviceOrders.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    // Validado na aplicação: manual | risk | epi (TEXT p/ ampliar fontes sem migration).
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id"),
    done: boolean("done").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_soi_org_id").on(table.orgId),
    index("idx_soi_order").on(table.orgId, table.serviceOrderId, table.sortOrder),
    pgPolicy("service_order_items_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type ServiceOrder = InferSelectModel<typeof serviceOrders>;
export type NewServiceOrder = InferInsertModel<typeof serviceOrders>;
export type ServiceOrderItem = InferSelectModel<typeof serviceOrderItems>;
export type NewServiceOrderItem = InferInsertModel<typeof serviceOrderItems>;
