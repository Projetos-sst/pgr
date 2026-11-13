import {
  pgTable,
  pgEnum,
  text,
  uuid,
  smallint,
  timestamp,
  index,
  uniqueIndex,
  check,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { addressColumns } from "./address-columns";
import { actorCompanyScope } from "./access-scope-policy";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

/** Situação cadastral da empresa (badge da listagem #188). */
export const companyStatus = pgEnum("company_status", ["active", "pending", "inactive"]);

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    cnpj: text("cnpj"),
    razaoSocial: text("razao_social").notNull(),
    nomeFantasia: text("nome_fantasia"),
    phone: text("phone"),
    email: text("email"),
    cnae: text("cnae"),
    mainActivity: text("main_activity"),
    riskGrade: smallint("risk_grade"),
    logoPath: text("logo_path"),
    website: text("website"),
    status: companyStatus("status").notNull().default("active"),
    // Classificação tributária do eSocial (S-1000 `classTrib`). Texto livre
    // (código eSocial) — evita catálogo enum extenso; nullable.
    taxClassification: text("tax_classification"),
    ...addressColumns(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_companies_id_org").on(table.id, table.orgId),
    index("idx_companies_org_id").on(table.orgId),
    uniqueIndex("uq_companies_org_id_cnpj").on(table.orgId, table.cnpj),
    check("companies_risk_grade_check", sql`risk_grade between 1 and 4`),
    pgPolicy("companies_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("companies_actor_scope", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: actorCompanyScope(table.id),
    }),
  ],
).enableRLS();

export type Company = InferSelectModel<typeof companies>;
export type NewCompany = InferInsertModel<typeof companies>;
