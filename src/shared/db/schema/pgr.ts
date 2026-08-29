import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  date,
  timestamp,
  index,
  unique,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { companies } from "./companies";
import { workUnits } from "./work-units";
import { ges } from "./ges";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

/** Tipo de registro do responsável técnico pelo PGR. */
export const pgrRegistrationType = pgEnum("pgr_registration_type", [
  "crm",
  "crea",
  "mte",
  "not_applicable",
]);

/**
 * Documento PGR (Programa de Gerenciamento de Riscos). Informações básicas:
 * empresa/obra, responsável/coordenador, registro técnico e datas de emissão e
 * validade. O PGR não inventaria riscos: vincula GES (via `pgr_ges`) e agrega os
 * riscos já inventariados nos GES da obra.
 */
export const pgr = pgTable(
  "pgr",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    // "Obra" = unidade de trabalho (opcional; SET NULL preserva o PGR se a obra sair).
    workUnitId: uuid("work_unit_id").references(() => workUnits.id, {
      onDelete: "set null",
    }),
    responsible: text("responsible"),
    registrationType: pgrRegistrationType("registration_type")
      .notNull()
      .default("not_applicable"),
    registrationNumber: text("registration_number"),
    issuedAt: date("issued_at"),
    validUntil: date("valid_until"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_pgr_org_id").on(table.orgId),
    index("idx_pgr_company_id").on(table.companyId),
    pgPolicy("pgr_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

/** Vínculo PGR ↔ GES (N:N). `unique(org_id, pgr_id, ges_id)` impede vínculo duplicado. */
export const pgrGes = pgTable(
  "pgr_ges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    pgrId: uuid("pgr_id")
      .notNull()
      .references(() => pgr.id, { onDelete: "cascade" }),
    gesId: uuid("ges_id")
      .notNull()
      .references(() => ges.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_pgr_ges_org_id").on(table.orgId),
    index("idx_pgr_ges_pgr_id").on(table.pgrId),
    index("idx_pgr_ges_ges_id").on(table.gesId),
    unique("uq_pgr_ges_org_pgr_ges").on(table.orgId, table.pgrId, table.gesId),
    pgPolicy("pgr_ges_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

/**
 * Histórico de revisões/versões do PGR (metadados de versão: número, data, notas).
 * `unique(org_id, pgr_id, revision_number)` impede número de revisão repetido.
 */
export const pgrRevisions = pgTable(
  "pgr_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    pgrId: uuid("pgr_id")
      .notNull()
      .references(() => pgr.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    revisedAt: date("revised_at").notNull().defaultNow(),
    notes: text("notes"),
    // Arquivamento (#46): null = revisão ativa; preenchido = quando foi arquivada.
    // Segue o padrão de `pgr.published_at` (0028) em vez de um boolean `archived`.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_pgr_revisions_org_id").on(table.orgId),
    index("idx_pgr_revisions_pgr_id").on(table.pgrId),
    unique("uq_pgr_revisions_org_pgr_number").on(
      table.orgId,
      table.pgrId,
      table.revisionNumber,
    ),
    pgPolicy("pgr_revisions_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type Pgr = InferSelectModel<typeof pgr>;
export type NewPgr = InferInsertModel<typeof pgr>;
export type PgrGes = InferSelectModel<typeof pgrGes>;
export type NewPgrGes = InferInsertModel<typeof pgrGes>;
export type PgrRevision = InferSelectModel<typeof pgrRevisions>;
export type NewPgrRevision = InferInsertModel<typeof pgrRevisions>;
