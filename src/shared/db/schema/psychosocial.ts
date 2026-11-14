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
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { companies } from "./companies";
import { workUnits } from "./work-units";
import { ges } from "./ges";
import { risks } from "./risks";
import { actorWorkUnitScope } from "./access-scope-policy";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

function isolationPolicy(name: string) {
  return pgPolicy(name, {
    for: "all",
    to: appRuntimeRole,
    using: tenantScope,
    withCheck: tenantScope,
  });
}

// Ciclo de vida da campanha psicossocial (NR-01/GRO).
export const psychosocialCampaignStatus = pgEnum("psychosocial_campaign_status", [
  "draft",
  "active",
  "closed",
  "archived",
]);

// Tipos de pergunta do questionário.
export const psychosocialQuestionType = pgEnum("psychosocial_question_type", [
  "likert",
  "multiple_choice",
  "free_text",
]);

// Nível do fator de risco psicossocial (catálogo por GES, NR-01). Rótulos PT na UI.
export const psychosocialRiskLevel = pgEnum("psychosocial_risk_level", [
  "low",
  "medium",
  "high",
]);

// Situação do tratamento do fator (catálogo por GES). Rótulos PT na UI.
export const psychosocialFactorStatus = pgEnum("psychosocial_factor_status", [
  "in_action",
  "monitored",
  "controlled",
]);

// ── Campanha ────────────────────────────────────────────────────────────────
export const psychosocialCampaigns = pgTable(
  "psychosocial_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    workUnitId: uuid("work_unit_id")
      .notNull()
      .references(() => workUnits.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startsAt: date("starts_at"),
    endsAt: date("ends_at"),
    themeColor: text("theme_color"),
    coverPath: text("cover_path"),
    workerDescription: text("worker_description"),
    status: psychosocialCampaignStatus("status").notNull().default("draft"),
    // Token do link público (compartilhável); gerado no servidor, único global.
    publicToken: text("public_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy("psychosocial_campaigns_actor_scope", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: actorWorkUnitScope(table.companyId, table.workUnitId),
    }),
    index("idx_psychosocial_campaigns_org_id").on(table.orgId),
    index("idx_psychosocial_campaigns_work_unit").on(table.workUnitId),
    uniqueIndex("uq_psychosocial_campaigns_public_token").on(table.publicToken),
    isolationPolicy("psychosocial_campaigns_isolation"),
    // Capability: leitura pública da campanha pelo token (rota anônima), sem
    // tenant de ambiente. Espelha a policy de token das assinaturas (fatia 010).
    pgPolicy("psychosocial_campaigns_token_read", {
      for: "select",
      to: appRuntimeRole,
      using: sql`public_token = current_setting('app.psychosocial_token', true)`,
    }),
  ],
).enableRLS();

// ── Pergunta (sub-entidade da campanha) ─────────────────────────────────────
export const psychosocialQuestions = pgTable(
  "psychosocial_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => psychosocialCampaigns.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    questionType: psychosocialQuestionType("question_type").notNull(),
    // Opções da múltipla escolha (uma por linha); null nos demais tipos.
    options: text("options"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_psychosocial_questions_org_id").on(table.orgId),
    index("idx_psychosocial_questions_campaign").on(table.campaignId),
    isolationPolicy("psychosocial_questions_isolation"),
  ],
).enableRLS();

// ── Resposta (submissão anônima por token) ──────────────────────────────────
export const psychosocialResponses = pgTable(
  "psychosocial_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => psychosocialCampaigns.id, { onDelete: "cascade" }),
    // Token do participante — anônimo (não vincula ao trabalhador), único.
    token: uuid("token").notNull().defaultRandom(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_psychosocial_responses_org_id").on(table.orgId),
    index("idx_psychosocial_responses_campaign").on(table.campaignId),
    uniqueIndex("uq_psychosocial_responses_token").on(table.token),
    isolationPolicy("psychosocial_responses_isolation"),
  ],
).enableRLS();

// ── Resposta a cada pergunta ────────────────────────────────────────────────
export const psychosocialAnswers = pgTable(
  "psychosocial_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    responseId: uuid("response_id")
      .notNull()
      .references(() => psychosocialResponses.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => psychosocialQuestions.id, { onDelete: "cascade" }),
    // Likert 1–5 ou índice da múltipla escolha; null no texto livre.
    valueInt: integer("value_int"),
    // Texto livre; null nos tipos numéricos.
    valueText: text("value_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_psychosocial_answers_org_id").on(table.orgId),
    index("idx_psychosocial_answers_response").on(table.responseId),
    uniqueIndex("uq_psychosocial_answers_response_question").on(
      table.responseId,
      table.questionId,
    ),
    isolationPolicy("psychosocial_answers_isolation"),
  ],
).enableRLS();

// ── Risco psicossocial derivado ─────────────────────────────────────────────
export const psychosocialRisks = pgTable(
  "psychosocial_risks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => psychosocialCampaigns.id, { onDelete: "cascade" }),
    factor: text("factor").notNull(),
    level: integer("level").notNull(),
    description: text("description"),
    sourceQuestionId: uuid("source_question_id").references(
      () => psychosocialQuestions.id,
      { onDelete: "set null" },
    ),
    // Vínculo ao inventário de riscos (setado ao "Registrar no PGR").
    riskId: uuid("risk_id").references(() => risks.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_psychosocial_risks_org_id").on(table.orgId),
    index("idx_psychosocial_risks_campaign").on(table.campaignId),
    uniqueIndex("uq_psychosocial_risks_campaign_factor").on(
      table.orgId,
      table.campaignId,
      table.factor,
    ),
    isolationPolicy("psychosocial_risks_isolation"),
  ],
).enableRLS();

// ── Catálogo de fatores de risco psicossocial (standalone, por GES) ─────────
// Conceito distinto de `psychosocial_risks` (que é derivado de uma campanha):
// este é um CATÁLOGO independente de fatores mapeados por GES (NR-01), com
// código sequencial por tenant, nível, método de avaliação e situação. NÃO
// referencia campanhas — campanhas podem, no futuro, consumir este catálogo.
export const psychosocialRiskFactors = pgTable(
  "psychosocial_risk_factors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    // Código sequencial por tenant ("PS-07"); gerado no servidor na criação.
    number: integer("number").notNull(),
    // Fator de risco psicossocial (ex.: "Sobrecarga de trabalho").
    name: text("name").notNull(),
    // GES ao qual o fator está mapeado. CASCADE para não travar a exclusão em
    // cascata da empresa (companies → work_units → ges).
    gesId: uuid("ges_id")
      .notNull()
      .references(() => ges.id, { onDelete: "cascade" }),
    level: psychosocialRiskLevel("level").notNull(),
    // Método de avaliação — texto livre (ex.: "Questionário COPSOQ",
    // "Escuta ativa", "Entrevista"); conjunto não é fechado por regulamentação.
    assessmentMethod: text("assessment_method"),
    status: psychosocialFactorStatus("status").notNull().default("monitored"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_psychosocial_risk_factors_org_id").on(table.orgId),
    index("idx_psychosocial_risk_factors_ges").on(table.gesId),
    uniqueIndex("uq_psychosocial_risk_factors_org_number").on(table.orgId, table.number),
    isolationPolicy("psychosocial_risk_factors_isolation"),
  ],
).enableRLS();

export type PsychosocialCampaign = InferSelectModel<typeof psychosocialCampaigns>;
export type NewPsychosocialCampaign = InferInsertModel<typeof psychosocialCampaigns>;
export type PsychosocialCampaignStatus = PsychosocialCampaign["status"];
export type PsychosocialQuestion = InferSelectModel<typeof psychosocialQuestions>;
export type NewPsychosocialQuestion = InferInsertModel<typeof psychosocialQuestions>;
export type PsychosocialQuestionTypeValue = PsychosocialQuestion["questionType"];
export type PsychosocialResponse = InferSelectModel<typeof psychosocialResponses>;
export type NewPsychosocialResponse = InferInsertModel<typeof psychosocialResponses>;
export type PsychosocialAnswer = InferSelectModel<typeof psychosocialAnswers>;
export type NewPsychosocialAnswer = InferInsertModel<typeof psychosocialAnswers>;
export type PsychosocialRisk = InferSelectModel<typeof psychosocialRisks>;
export type NewPsychosocialRisk = InferInsertModel<typeof psychosocialRisks>;
export type PsychosocialRiskFactor = InferSelectModel<typeof psychosocialRiskFactors>;
export type NewPsychosocialRiskFactor = InferInsertModel<typeof psychosocialRiskFactors>;
export type PsychosocialRiskLevelValue = PsychosocialRiskFactor["level"];
export type PsychosocialFactorStatusValue = PsychosocialRiskFactor["status"];
