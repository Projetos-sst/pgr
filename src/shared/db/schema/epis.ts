import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  date,
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
import { companies } from "./companies";
import { categories, categoryType } from "./categories";
import { employees } from "./employees";
import { risks } from "./risks";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

// Indicação de neutralização do risco por um EPI vinculado. Enum de 3 estados
// (o card exige "Sim / Não / Não Aplicável"): `not_applicable` cobre riscos em
// que o EPI é listado mas não neutraliza (ex.: ergonômico controlado por medida
// administrativa). Enum Postgres é forward-only.
export const epiNeutralization = pgEnum("epi_neutralization", [
  "neutralizes",
  "does_not_neutralize",
  "not_applicable",
]);

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
    // Empresa do EPI (#201, decisão R1) — nullable: catálogo pré-existente = escritório.
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    ca: text("ca"),
    caValidUntil: date("ca_valid_until"),
    manufacturer: text("manufacturer"),
    norm: text("norm"),
    material: text("material"),
    size: text("size"),
    unitOfMeasure: text("unit_of_measure"),
    // Vida útil em meses (#201) — inteiro positivo, nullable.
    usefulLifeMonths: integer("useful_life_months"),
    description: text("description"),
    photoPath: text("photo_path"),
    replacementDate: date("replacement_date"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_epi_catalog_org_id").on(table.orgId),
    index("idx_epi_catalog_category_id").on(table.categoryId),
    index("idx_epi_catalog_company_id").on(table.companyId),
    check("epi_catalog_useful_life_check", sql`useful_life_months > 0`),
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
    invoiceDate: date("invoice_date"),
    batch: text("batch"),
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
 * Vínculo EPI × risco (junção) com a indicação "neutraliza os riscos?".
 * Liga um item do catálogo (`catalog_id`) a um risco do inventário (`risk_id`,
 * fatia de Riscos & PGR) com o enum `neutralization` (Sim / Não / Não Aplicável).
 * Realiza a decisão D6 de `docs/briefings/implementacao-pgr-risks-data-model.md`:
 * o vínculo interino EPI × GES (fatia 008) passa a ser EPI × risco. Alimenta o PGR
 * (adequação de EPI por exposição). Único por par (org, item, risco).
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
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risks.id, { onDelete: "cascade" }),
    neutralization: epiNeutralization("neutralization").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_epi_risk_org_id").on(table.orgId),
    index("idx_epi_risk_catalog_id").on(table.catalogId),
    index("idx_epi_risk_risk_id").on(table.riskId),
    uniqueIndex("uq_epi_risk_org_catalog_risk").on(
      table.orgId,
      table.catalogId,
      table.riskId,
    ),
    pgPolicy("epi_risk_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

/**
 * Log de auditoria (append-only) das alterações do catálogo de EPI (#25).
 * Cada create/update de `epi_catalog` grava uma linha aqui com um resumo
 * textual do diff; sem update/delete pela aplicação (histórico imutável).
 */
export const epiCatalogAuditLog = pgTable(
  "epi_catalog_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    epiCatalogId: uuid("epi_catalog_id")
      .notNull()
      .references(() => epiCatalog.id, { onDelete: "cascade" }),
    changedBy: text("changed_by"),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
    summary: text("summary").notNull(),
  },
  (table) => [
    index("idx_epi_catalog_audit_log_org_id").on(table.orgId),
    index("idx_epi_catalog_audit_log_epi_catalog_id").on(table.epiCatalogId),
    pgPolicy("epi_catalog_audit_log_isolation", {
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
export type EpiCatalogAuditLog = InferSelectModel<typeof epiCatalogAuditLog>;
export type NewEpiCatalogAuditLog = InferInsertModel<typeof epiCatalogAuditLog>;
