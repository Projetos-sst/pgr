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
import { actorCompanyScope, officeWideOr } from "./access-scope-policy";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

// Posicionamento do cabeçalho ISO no documento gerado (consumido pelo pipeline
// Gotenberg em outra fatia; aqui só a configuração).
export const formControlPosition = pgEnum("form_control_position", [
  "top",
  "bottom",
  "both",
]);

// Categoria do formulário (Ficha/Checklist/Documento) — metadado de catálogo do
// redesign. NÃO afeta o pipeline ISO/Gotenberg (que usa frm_code/revision/position).
export const formControlType = pgEnum("form_control_type", [
  "ficha",
  "checklist",
  "documento",
]);

// Situação do formulário no catálogo (Rascunho/Publicado/Arquivado) — metadado do
// redesign; substitui o "Ativo" fixo da lista por estado real.
export const formControlStatus = pgEnum("form_control_status", [
  "draft",
  "published",
  "archived",
]);

export const formControls = pgTable(
  "form_controls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    formType: text("form_type").notNull(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    frmCode: text("frm_code").notNull(),
    revision: text("revision").notNull(),
    issueDate: date("issue_date").notNull(),
    nonConformityNumber: text("non_conformity_number"),
    gesId: uuid("ges_id").references(() => ges.id, { onDelete: "set null" }),
    position: formControlPosition("position").notNull().default("top"),
    // Metadados de catálogo do redesign (não usados pelo pipeline Gotenberg).
    type: formControlType("type").notNull().default("documento"),
    status: formControlStatus("status").notNull().default("published"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy("form_controls_actor_scope", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: officeWideOr(table.companyId, actorCompanyScope(table.companyId)),
    }),
    index("idx_form_controls_org_id").on(table.orgId),
    index("idx_form_controls_company_id").on(table.companyId),
    index("idx_form_controls_ges_id").on(table.gesId),
    uniqueIndex("uq_form_controls_org_frm_code").on(table.orgId, table.frmCode),
    pgPolicy("form_controls_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type FormControl = InferSelectModel<typeof formControls>;
export type NewFormControl = InferInsertModel<typeof formControls>;
