import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  smallint,
  numeric,
  date,
  boolean,
  timestamp,
  index,
  unique,
  check,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { ges } from "./ges";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

/**
 * Grupo do agente de risco (NR-01 / GRO). São 7 grupos: os 6 do escopo ePGR com
 * "Mecânicos/Acidentes" desmembrado em `mechanical` e `accident` para atender ao
 * critério de aceite (7 grupos) e ao detalhamento eSocial. Rótulos pt-BR vivem no
 * domínio (`domains/pgr/risks.ts`).
 */
export const riskAgentType = pgEnum("risk_agent_type", [
  "physical",
  "chemical",
  "biological",
  "ergonomic",
  "mechanical",
  "accident",
  "psychosocial",
]);

/** Faixas de tempo de exposição (8 faixas ePGR). */
export const exposureTime = pgEnum("exposure_time", [
  "lt_1h",
  "1_2h",
  "2_4h",
  "4_7h",
  "gt_7h",
  "eventual",
  "intermittent",
  "habitual",
]);

/**
 * Unidade de medida do agente nocivo (eSocial S-2240). Lista fechada (enum) para
 * impedir valores fora do conjunto; extensível por nova migration (`ALTER TYPE …
 * ADD VALUE` roda fora de transação — adicionar com cuidado). `qualitative_na` =
 * "Não aplicável / qualitativo".
 */
export const measurementUnit = pgEnum("measurement_unit", [
  "qualitative_na",
  "db_a",
  "db_c",
  "m_s2",
  "ppm",
  "mg_m3",
  "f_cm3",
  "celsius",
  "percent",
  "lux",
]);

/** Critério da avaliação de risco. */
export const assessmentCriterion = pgEnum("assessment_criterion", [
  "qualitative",
  "quantitative",
]);

/**
 * Nível da hierarquia de controle (NR-01, 4 níveis): I Eliminação · II Proteção
 * Coletiva · III Medidas Administrativas/Organização · IV EPI.
 */
export const controlLevel = pgEnum("control_level", [
  "elimination",
  "collective_protection",
  "administrative",
  "ppe",
]);

/**
 * Status da medida de controle (#42): mantida / introduzida / melhorada. Preenchido
 * pela regra de negócio a partir do nível de risco (fatia seguinte) — nullable aqui,
 * sem default forçado.
 */
export const controlMeasureStatus = pgEnum("control_measure_status", [
  "maintain",
  "introduced",
  "improved",
]);

/**
 * Inventário de riscos (NR-01/GRO + eSocial S-2240). Cada risco pertence a um GES
 * (a cadeia é GES → riscos → avaliação → controles). Campos descritivos são texto
 * livre; `agent_type` e `description` são obrigatórios.
 */
export const risks = pgTable(
  "risks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    gesId: uuid("ges_id")
      .notNull()
      .references(() => ges.id, { onDelete: "cascade" }),
    agentType: riskAgentType("agent_type").notNull(),
    hazard: text("hazard"),
    description: text("description").notNull(),
    sources: text("sources"),
    propagation: text("propagation"),
    exposureTime: exposureTime("exposure_time"),
    possibleInjuries: text("possible_injuries"),
    // eSocial S-2240: código do agente nocivo (ex. "01.01.001") + unidade de medida.
    noxiousAgentCode: text("noxious_agent_code"),
    measurementUnit: measurementUnit("measurement_unit"),
    // Concentração/intensidade quantitativa (nullable — só no critério quantitativo).
    concentrationIntensity: numeric("concentration_intensity"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_risks_org_id").on(table.orgId),
    index("idx_risks_ges_id").on(table.gesId),
    pgPolicy("risks_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

/**
 * Avaliação de risco — matriz 5×5. `risk_level` é persistido (= probabilidade ×
 * severidade) e protegido por CHECK de coerência no banco, além das faixas 1–5 /
 * 1–25 / 0–2. Histórico (1:N) por risco via `assessed_at`.
 */
export const riskAssessments = pgTable(
  "risk_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risks.id, { onDelete: "cascade" }),
    criterion: assessmentCriterion("criterion").notNull(),
    probability: integer("probability").notNull(),
    severity: integer("severity").notNull(),
    // Persistido pela aplicação (probabilidade × severidade); CHECK garante coerência.
    riskLevel: integer("risk_level").notNull(),
    // 0 Certa / 1 Incerta / 2 Altamente Incerta.
    uncertaintyDegree: smallint("uncertainty_degree").notNull().default(0),
    toleranceLimit: text("tolerance_limit"),
    result: text("result"),
    assessedAt: date("assessed_at").notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_risk_assessments_org_id").on(table.orgId),
    index("idx_risk_assessments_risk_id").on(table.riskId),
    check("risk_assessments_probability_check", sql`probability between 1 and 5`),
    check("risk_assessments_severity_check", sql`severity between 1 and 5`),
    check("risk_assessments_risk_level_range_check", sql`risk_level between 1 and 25`),
    check(
      "risk_assessments_risk_level_coherence_check",
      sql`risk_level = probability * severity`,
    ),
    check(
      "risk_assessments_uncertainty_degree_check",
      sql`uncertainty_degree between 0 and 2`,
    ),
    pgPolicy("risk_assessments_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

/**
 * Medidas de controle — hierarquia NR-01 (4 níveis). Uma linha por (risco × nível);
 * `applicable` + justificativa/monitoramento; campos 5W2H do plano de ação são
 * preenchidos quando aplicável. `unique(org_id, risk_id, control_level)` impede
 * nível duplicado para o mesmo risco.
 */
export const controlMeasures = pgTable(
  "control_measures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risks.id, { onDelete: "cascade" }),
    controlLevel: controlLevel("control_level").notNull(),
    applicable: boolean("applicable").notNull().default(false),
    status: controlMeasureStatus("status"),
    justification: text("justification"),
    monitoring: text("monitoring"),
    // Plano de ação 5W2H.
    actionWhat: text("action_what"),
    actionHow: text("action_how"),
    actionTracking: text("action_tracking"),
    actionMeasurement: text("action_measurement"),
    actionResponsible: text("action_responsible"),
    actionDeadline: date("action_deadline"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_control_measures_org_id").on(table.orgId),
    index("idx_control_measures_risk_id").on(table.riskId),
    unique("uq_control_measures_org_risk_level").on(
      table.orgId,
      table.riskId,
      table.controlLevel,
    ),
    pgPolicy("control_measures_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type Risk = InferSelectModel<typeof risks>;
export type NewRisk = InferInsertModel<typeof risks>;
export type RiskAssessment = InferSelectModel<typeof riskAssessments>;
export type NewRiskAssessment = InferInsertModel<typeof riskAssessments>;
export type ControlMeasure = InferSelectModel<typeof controlMeasures>;
export type NewControlMeasure = InferInsertModel<typeof controlMeasures>;
