import {
  pgTable,
  pgEnum,
  text,
  uuid,
  timestamp,
  jsonb,
  unique,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import type {
  ClassificationBand,
  MethodologyGrade,
} from "@/shared/domains/pgr/methodology";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";

export const methodologyBase = pgEnum("methodology_base", [
  "aiha",
  "as_nzs_4360",
  "fundacentro",
  "custom",
]);

export const riskClassification = pgEnum("risk_classification", [
  "trivial",
  "tolerable",
  "moderate",
  "substantial",
  "intolerable",
]);

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

/**
 * Metodologia de avaliação de riscos — **uma linha por organização** (issue #76).
 * Gradações (probabilidade/severidade) e faixas de classificação vivem em JSONB
 * (cardinalidade fixa, conteúdo validado por Zod no domínio). `unique(org_id)`
 * garante o singleton e serve de alvo do upsert.
 */
export const riskMethodology = pgTable(
  "risk_methodology",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    base: methodologyBase("base").notNull(),
    probabilityGrades: jsonb("probability_grades").$type<MethodologyGrade[]>().notNull(),
    severityGrades: jsonb("severity_grades").$type<MethodologyGrade[]>().notNull(),
    classificationBands: jsonb("classification_bands")
      .$type<ClassificationBand[]>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_risk_methodology_org").on(table.orgId),
    pgPolicy("risk_methodology_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type RiskMethodology = InferSelectModel<typeof riskMethodology>;
export type NewRiskMethodology = InferInsertModel<typeof riskMethodology>;
