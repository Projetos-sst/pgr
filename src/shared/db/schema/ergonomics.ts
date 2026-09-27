import {
  pgTable,
  pgEnum,
  text,
  uuid,
  date,
  timestamp,
  index,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";

import { appRuntimeRole } from "../roles";
import { orgs } from "./orgs";
import { risks } from "./risks";
import { psychosocialCampaigns } from "./psychosocial";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

/**
 * Adequação de uma dimensão ergonômica (NR-17) — issue #40, decisão Q2 do Lote 3.
 *
 * Três estados só: adequado, inadequado e "não se aplica". **Não existe escala
 * numérica nem score**: a NR-17 não fixa uma, e inventar uma seria criar
 * semântica normativa que o sistema não tem.
 *
 * `NULL` na coluna ≠ `not_applicable`. Nulo = a dimensão **não foi avaliada**
 * (avaliação parcial é legítima); `not_applicable` = o profissional **declarou**
 * que a dimensão não se aplica àquele contexto. O PDF e a tela imprimem coisas
 * diferentes para cada caso, e nenhum dos dois vira "adequado".
 */
export const ergonomicAdequacy = pgEnum("ergonomic_adequacy", [
  "adequate",
  "inadequate",
  "not_applicable",
]);

/**
 * Avaliação ergonômica preliminar (AEP) da NR-17 — issue #40.
 *
 * Tabela **dedicada** (decisão Q1 = B), 1:N por risco: a AEP é um instrumento com
 * data, responsável e método próprios, e `risk_assessments` continua sendo a matriz
 * 5×5 (já ampliada pela NR-09 no Lote 2). Histórico é preservado — criar avaliação
 * nova nunca sobrescreve a anterior; a **vigente** é a de maior `assessed_at`
 * (desempate por `created_at`, depois `id`, em `domains/pgr/ergonomics.ts`).
 *
 * A AET (análise ergonômica do trabalho) **não** vive aqui: é laudo anexado ao risco
 * pelo GED (`related_entity_type = 'risk'`), que já versiona desde a #56.
 */
export const ergonomicEvaluations = pgTable(
  "ergonomic_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risks.id, { onDelete: "cascade" }),

    // --- Seis dimensões da NR-17 (adequação + observação, todas opcionais) ------
    posture: ergonomicAdequacy("posture"),
    postureNotes: text("posture_notes"),
    movements: ergonomicAdequacy("movements"),
    movementsNotes: text("movements_notes"),
    physicalLoad: ergonomicAdequacy("physical_load"),
    physicalLoadNotes: text("physical_load_notes"),
    mentalLoad: ergonomicAdequacy("mental_load"),
    mentalLoadNotes: text("mental_load_notes"),
    workOrganization: ergonomicAdequacy("work_organization"),
    workOrganizationNotes: text("work_organization_notes"),
    physicalEnvironment: ergonomicAdequacy("physical_environment"),
    physicalEnvironmentNotes: text("physical_environment_notes"),

    // --- Identificação da avaliação --------------------------------------------
    // Método/instrumento como o profissional informou (ex.: "RULA", "COPSOQ"). Texto
    // livre de propósito: o conjunto de instrumentos não é fechado por norma.
    method: text("method"),
    // Responsável é o que foi DIGITADO no registro — nunca o usuário logado nem o
    // responsável técnico do PGR. Não há cadastro estruturado de profissional (#36).
    responsible: text("responsible"),
    assessedAt: date("assessed_at").notNull().defaultNow(),
    notes: text("notes"),

    // --- Vínculo psicossocial (opcional, agregado — decisão Q3 = A) -------------
    // Aponta para uma campanha psicossocial do MESMO tenant e do MESMO contexto
    // (unidade do GES do risco), em estado `closed` quando usada como resultado
    // consolidado. O documento lê apenas o AGREGADO da campanha (nome, período,
    // nº de respostas, fatores derivados) — nunca resposta individual. Não existe
    // cálculo de escore COPSOQ: o sistema não implementa a metodologia.
    psychosocialCampaignId: uuid("psychosocial_campaign_id").references(
      () => psychosocialCampaigns.id,
      { onDelete: "set null" },
    ),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_ergonomic_evaluations_org_id").on(table.orgId),
    index("idx_ergonomic_evaluations_risk_id").on(table.riskId),
    // Leitura quente: histórico e vigente por risco dentro do tenant.
    index("idx_ergonomic_evaluations_org_risk_assessed").on(
      table.orgId,
      table.riskId,
      table.assessedAt,
    ),
    index("idx_ergonomic_evaluations_campaign").on(table.psychosocialCampaignId),
    pgPolicy("ergonomic_evaluations_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type ErgonomicEvaluation = InferSelectModel<typeof ergonomicEvaluations>;
export type NewErgonomicEvaluation = InferInsertModel<typeof ergonomicEvaluations>;
export type ErgonomicAdequacyValue = ErgonomicEvaluation["posture"];
