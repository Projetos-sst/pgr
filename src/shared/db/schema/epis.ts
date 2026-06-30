import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  date,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
  foreignKey,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { categories, categoryType } from "./categories";
import { employees } from "./employees";
import { ges } from "./ges";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

// Tipo de movimento de estoque (compra / entrega ao funcionário / ajuste /
// descarte / devolução pelo funcionário). Enum Postgres é forward-only (R5):
// valores só entram via ALTER TYPE ... ADD VALUE, nunca saem.
export const stockMovementType = pgEnum("stock_movement_type", [
  "purchase",
  "employee_delivery",
  "adjustment",
  "discard",
  "employee_return",
]);

// Status de assinatura da entrega (pendente / assinada via QR / link / manual).
export const epiSignatureStatus = pgEnum("epi_signature_status", [
  "pending",
  "signed_qr",
  "signed_link",
  "signed_manual",
]);

/**
 * Catálogo de itens (EPI / Máquinas e Equipamentos). A taxonomia que filtra o
 * catálogo é a tabela `categories` (006) — reusada via `category_id`; o `type`
 * reusa o enum `category_type` (`epi`/`machine`).
 */
export const epiCatalog = pgTable(
  "epi_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    type: categoryType("type").notNull(),
    categoryId: uuid("category_id").notNull(),
    name: text("name").notNull(),
    ca: text("ca"),
    caValidUntil: date("ca_valid_until"),
    manufacturer: text("manufacturer"),
    norm: text("norm"),
    size: text("size"),
    unitOfMeasure: text("unit_of_measure"),
    description: text("description"),
    photoPath: text("photo_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_epi_catalog_org_id").on(table.orgId),
    index("idx_epi_catalog_category_id").on(table.categoryId),
    // FK composta (category_id, type) → categories(id, type): garante no banco que o tipo do
    // item é igual ao tipo da sua categoria (FR-002a). ON DELETE RESTRICT preserva categoria
    // em uso. Substitui a FK simples sobre category_id.
    foreignKey({
      columns: [table.categoryId, table.type],
      foreignColumns: [categories.id, categories.type],
      name: "epi_catalog_category_id_type_fk",
    }).onDelete("restrict"),
    pgPolicy("epi_catalog_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

/**
 * Estoque por item do catálogo. Saldo materializado (`balance`) + quantidade
 * mínima (`min_quantity`). A manutenção do saldo a partir dos movimentos é da
 * camada de fluxo (Fase 2); aqui só o modelo + constraints.
 */
export const epiStock = pgTable(
  "epi_stock",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    catalogId: uuid("catalog_id")
      .notNull()
      .references(() => epiCatalog.id, { onDelete: "cascade" }),
    balance: integer("balance").notNull().default(0),
    minQuantity: integer("min_quantity").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_epi_stock_org_id").on(table.orgId),
    uniqueIndex("uq_epi_stock_org_catalog").on(table.orgId, table.catalogId),
    check("epi_stock_balance_check", sql`balance >= 0`),
    check("epi_stock_min_quantity_check", sql`min_quantity >= 0`),
    pgPolicy("epi_stock_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

/**
 * Movimentos de estoque tipados. `quantity` é sempre positivo; o `type` define o
 * efeito (entrada/saída) no saldo. `delivery_id` liga o movimento à entrega que o
 * originou (nullable; `SET NULL` ao excluir a entrega).
 */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    stockId: uuid("stock_id")
      .notNull()
      .references(() => epiStock.id, { onDelete: "cascade" }),
    deliveryId: uuid("delivery_id").references(() => epiDeliveries.id, {
      onDelete: "set null",
    }),
    type: stockMovementType("type").notNull(),
    quantity: integer("quantity").notNull(),
    movementDate: date("movement_date").notNull().defaultNow(),
    invoiceNumber: text("invoice_number"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_stock_movements_org_id").on(table.orgId),
    index("idx_stock_movements_stock_id").on(table.stockId),
    index("idx_stock_movements_delivery_id").on(table.deliveryId),
    check("stock_movements_quantity_check", sql`quantity > 0`),
    pgPolicy("stock_movements_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

/**
 * Entregas de EPI a funcionários, com status de assinatura e token de
 * autenticação para assinatura via QR Code / link. `auth_token` é único quando
 * presente (índice parcial).
 */
export const epiDeliveries = pgTable(
  "epi_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    deliveryDate: date("delivery_date").notNull().defaultNow(),
    signatureStatus: epiSignatureStatus("signature_status").notNull().default("pending"),
    authToken: text("auth_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_epi_deliveries_org_id").on(table.orgId),
    index("idx_epi_deliveries_employee_id").on(table.employeeId),
    uniqueIndex("uq_epi_deliveries_auth_token")
      .on(table.authToken)
      .where(sql`auth_token is not null`),
    pgPolicy("epi_deliveries_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

/** Itens de cada entrega (item do catálogo × quantidade entregue). */
export const epiDeliveryItems = pgTable(
  "epi_delivery_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => epiDeliveries.id, { onDelete: "cascade" }),
    catalogId: uuid("catalog_id")
      .notNull()
      .references(() => epiCatalog.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    // Devolução (US4): NULL = em uso; preenchido = devolvido (one-shot, guard
    // na aplicação). A devolução repõe o saldo via movimento `employee_return`.
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_epi_delivery_items_org_id").on(table.orgId),
    index("idx_epi_delivery_items_delivery_id").on(table.deliveryId),
    index("idx_epi_delivery_items_catalog_id").on(table.catalogId),
    check("epi_delivery_items_quantity_check", sql`quantity > 0`),
    pgPolicy("epi_delivery_items_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

/**
 * Vínculo EPI × risco do GES (junção) com a flag "neutraliza os riscos?".
 * Liga, de forma **interina**, o EPI ao `ges` (entidade portadora de risco na cadeia
 * 008). Com o inventário dedicado (`risks`, fatia de Riscos & PGR) já disponível, a
 * reescrita da FK para `risk_id` está planejada como follow-up dedicado — ver
 * `docs/briefings/implementacao-pgr-risks-data-model.md` (decisão D6).
 */
export const epiRisk = pgTable(
  "epi_risk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    catalogId: uuid("catalog_id")
      .notNull()
      .references(() => epiCatalog.id, { onDelete: "cascade" }),
    gesId: uuid("ges_id")
      .notNull()
      .references(() => ges.id, { onDelete: "cascade" }),
    neutralizes: boolean("neutralizes").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_epi_risk_org_id").on(table.orgId),
    index("idx_epi_risk_catalog_id").on(table.catalogId),
    index("idx_epi_risk_ges_id").on(table.gesId),
    uniqueIndex("uq_epi_risk_org_catalog_ges").on(
      table.orgId,
      table.catalogId,
      table.gesId,
    ),
    pgPolicy("epi_risk_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type EpiCatalog = InferSelectModel<typeof epiCatalog>;
export type NewEpiCatalog = InferInsertModel<typeof epiCatalog>;
export type EpiStock = InferSelectModel<typeof epiStock>;
export type NewEpiStock = InferInsertModel<typeof epiStock>;
export type StockMovement = InferSelectModel<typeof stockMovements>;
export type NewStockMovement = InferInsertModel<typeof stockMovements>;
export type EpiDelivery = InferSelectModel<typeof epiDeliveries>;
export type NewEpiDelivery = InferInsertModel<typeof epiDeliveries>;
export type EpiDeliveryItem = InferSelectModel<typeof epiDeliveryItems>;
export type NewEpiDeliveryItem = InferInsertModel<typeof epiDeliveryItems>;
export type EpiRisk = InferSelectModel<typeof epiRisk>;
export type NewEpiRisk = InferInsertModel<typeof epiRisk>;
