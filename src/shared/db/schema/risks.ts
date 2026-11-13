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
import { companyModuleScope } from "./module-policy";

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
 * Conclusão da avaliação quantitativa NR-09 (item 9.4.3) — issue #39. Três estados,
 * deliberadamente curtos: abaixo do limite, acima do limite e não aplicável (agente
 * sem limite numérico). É **informada pelo profissional**; o sistema apenas sugere
 * (`suggestNr09Conclusion`, domínio puro) e nunca sobrescreve a escolha humana.
 */
export const nr09Conclusion = pgEnum("nr09_conclusion", [
  "below_limit",
  "above_limit",
  "not_applicable",
]);

export const controlLevel = pgEnum("control_level", [
  "elimination",
  "substitution",
  "collective_protection",
  "administrative",
  "ppe",
]);

/**
 * Status da medida de controle (#42): mantida / introduzida / aprimorada. Preenchido
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
    pgPolicy("risks_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: sql`exists (select 1 from public.ges g where g.id = ${table.gesId} and g.org_id = ${table.orgId} and ${companyModuleScope(table.orgId, sql`g.company_id`, "pgr")})`,
      withCheck: sql`exists (select 1 from public.ges g where g.id = ${table.gesId} and g.org_id = ${table.orgId} and ${companyModuleScope(table.orgId, sql`g.company_id`, "pgr")})`,
    }),
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
    // --- Avaliação quantitativa NR-09 (issue #39) -------------------------------
    // Só fazem sentido no critério `quantitative`; todos nullable porque a avaliação
    // qualitativa (maioria) continua exatamente como era. O valor medido mora AQUI (é
    // um evento datado), não em `risks.concentration_intensity`, que segue como
    // concentração de referência do risco.
    evaluationMethod: text("evaluation_method"),
    measuredValue: numeric("measured_value"),
    measuredUnit: measurementUnit("measured_unit"),
    toleranceLimitValue: numeric("tolerance_limit_value"),
    nr09Conclusion: nr09Conclusion("nr09_conclusion"),
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
    // NR-09 (#39): valor medido exige unidade, e a unidade não pode ser a marca de
    // "qualitativo/não aplicável" — medição sem unidade não é medição.
    check(
      "risk_assessments_measured_unit_check",
      sql`measured_value is null or (measured_unit is not null and measured_unit <> 'qualitative_na')`,
    ),
    // Campo quantitativo preenchido exige `criterion = 'quantitative'`.
    check(
      "risk_assessments_quantitative_criterion_check",
      sql`criterion = 'quantitative' or (measured_value is null and measured_unit is null and tolerance_limit_value is null and nr09_conclusion is null and evaluation_method is null)`,
    ),
    pgPolicy("risk_assessments_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: sql`exists (select 1 from public.risks r where r.id = ${table.riskId} and r.org_id = ${table.orgId})`,
      withCheck: sql`exists (select 1 from public.risks r where r.id = ${table.riskId} and r.org_id = ${table.orgId})`,
    }),
    pgPolicy("risk_assessments_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

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
    // Plano de ação 5W2H — completo desde a issue #47: o quê (`action_what`), por quê
    // (`action_why`), onde (derivado do GES do risco), quando (`action_deadline`), quem
    // (`action_responsible`), como (`action_how`) e quanto (`action_cost`, custo estimado
    // em `numeric` como os demais valores de domínio). Nada é obrigatório
    // retroativamente: medida antiga sem motivo/custo aparece como ausência honesta.
    actionWhat: text("action_what"),
    actionWhy: text("action_why"),
    actionHow: text("action_how"),
    actionTracking: text("action_tracking"),
    actionMeasurement: text("action_measurement"),
    actionResponsible: text("action_responsible"),
    actionDeadline: date("action_deadline"),
    actionCost: numeric("action_cost"),
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
    pgPolicy("control_measures_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: sql`exists (select 1 from public.risks r where r.id = ${table.riskId} and r.org_id = ${table.orgId})`,
      withCheck: sql`exists (select 1 from public.risks r where r.id = ${table.riskId} and r.org_id = ${table.orgId})`,
    }),
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
