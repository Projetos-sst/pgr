import { sql, type InferSelectModel, type SQL } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { appRuntimeRole } from "../roles";
import { companies } from "./companies";
import { medicos } from "./medicos";
import { companyModuleScope } from "./module-policy";
import { orgs } from "./orgs";

/**
 * Plano de exames por grupo de exposição (NOB-150, MED-15): proposta a partir dos riscos
 * validados (NOB-147) que o médico coordenador revisa (mantém, retira com justificativa,
 * acrescenta, ajusta a periodicidade) e aprova. Versionado: aprovar substitui o anterior, que
 * fica "superseded"; nada é apagado. Aprovado não muda (itens só mudam em rascunho).
 */
export const examPlanStatus = pgEnum("exam_plan_status", [
  "draft",
  "approved",
  "superseded",
]);
export const examPlanItemOrigin = pgEnum("exam_plan_item_origin", ["suggested", "added"]);
export const examPlanItemDecision = pgEnum("exam_plan_item_decision", [
  "kept",
  "removed",
]);

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;
const actor = sql`current_setting('app.current_actor', true)`;

/**
 * A conta da sessão é a coordenadora do PCMSO da empresa: designação aberta (NOB-144) + vínculo
 * aberto da conta ao profissional (NOB-149) + profissional ativo + associação viva. Mesmo
 * predicado de `assertActorIsCompanyCoordinator`, imposto também no banco.
 */
export function actorCoordinatesCompany(
  org: AnyPgColumn | SQL,
  company: AnyPgColumn | SQL,
) {
  return sql`exists (select 1 from public.pcmso_coordinator_assignments a
    join public.medico_user_links l on l.org_id = a.org_id and l.medico_id = a.medico_id and l.revoked_at is null
    join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id and m.status = 'active'
    join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
    where a.org_id = ${org} and a.company_id = ${company} and a.ends_on is null and l.user_id = ${actor})`;
}

export const medicalExamPlans = pgTable(
  "medical_exam_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    version: integer("version").notNull(),
    status: examPlanStatus("status").notNull().default("draft"),
    /** Fontes de risco (id, tipo, versão) e versões das regras e do catálogo usadas na proposta. */
    basedOn: jsonb("based_on").notNull(),
    rulesVersion: text("rules_version").notNull(),
    catalogVersion: text("catalog_version").notNull(),
    preparedBy: text("prepared_by").notNull(),
    approvedByUser: text("approved_by_user"),
    approvedByMedicoId: uuid("approved_by_medico_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvalNote: text("approval_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_exam_plans_identity").on(t.id, t.orgId, t.companyId),
    unique("uq_exam_plans_version").on(t.orgId, t.companyId, t.version),
    uniqueIndex("uq_exam_plans_open_draft")
      .on(t.orgId, t.companyId)
      .where(sql`${t.status} = 'draft'`),
    uniqueIndex("uq_exam_plans_approved")
      .on(t.orgId, t.companyId)
      .where(sql`${t.status} = 'approved'`),
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.approvedByMedicoId, t.orgId],
      foreignColumns: [medicos.id, medicos.orgId],
    }).onDelete("restrict"),
    index("idx_exam_plans_company").on(t.orgId, t.companyId, t.version),
    check("ck_exam_plans_version", sql`${t.version} > 0`),
    check(
      "ck_exam_plans_approval",
      sql`(${t.status} = 'draft') = (${t.approvedAt} is null) and (${t.approvedAt} is null) = (${t.approvedByUser} is null) and (${t.approvedAt} is null) = (${t.approvedByMedicoId} is null)`,
    ),
    pgPolicy("exam_plans_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("exam_plans_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    // A equipe prepara o rascunho; ninguém insere plano já aprovado.
    pgPolicy("exam_plans_draft_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.status} = 'draft' and ${t.preparedBy} = ${actor}`,
    }),
    // Só a coordenadora aprova (approved_by_user = ator) ou substitui o aprovado anterior.
    pgPolicy("exam_plans_coordinator_transition", {
      as: "restrictive",
      for: "update",
      to: appRuntimeRole,
      using: sql`${t.status} in ('draft','approved') and ${actorCoordinatesCompany(t.orgId, t.companyId)}`,
      withCheck: sql`(${t.status} = 'approved' and ${t.approvedByUser} = ${actor}) or ${t.status} = 'superseded'`,
    }),
  ],
).enableRLS();

export const medicalExamPlanItems = pgTable(
  "medical_exam_plan_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    planId: uuid("plan_id").notNull(),
    exposureGroup: text("exposure_group").notNull(),
    jobRole: text("job_role").notNull().default(""),
    procedureCode: text("procedure_code").notNull(),
    otherDescription: text("other_description"),
    origin: examPlanItemOrigin("origin").notNull(),
    ruleId: text("rule_id"),
    decision: examPlanItemDecision("decision").notNull().default("kept"),
    justification: text("justification"),
    periodicity: text("periodicity").notNull(),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => {
    const draftPlan = sql`exists (select 1 from public.medical_exam_plans p where p.id = ${t.planId} and p.org_id = ${t.orgId} and p.status = 'draft')`;
    const coordinator = actorCoordinatesCompany(t.orgId, t.companyId);
    return [
      foreignKey({
        columns: [t.planId, t.orgId, t.companyId],
        foreignColumns: [
          medicalExamPlans.id,
          medicalExamPlans.orgId,
          medicalExamPlans.companyId,
        ],
      }).onDelete("restrict"),
      uniqueIndex("uq_exam_plan_items_procedure").on(
        t.planId,
        t.exposureGroup,
        t.jobRole,
        t.procedureCode,
      ),
      index("idx_exam_plan_items_plan").on(t.orgId, t.planId),
      check("ck_exam_plan_items_code", sql`${t.procedureCode} ~ '^[0-9]{4}$'`),
      check(
        "ck_exam_plan_items_other",
        sql`(${t.procedureCode} = '9999') = (${t.otherDescription} is not null)`,
      ),
      check(
        "ck_exam_plan_items_origin",
        sql`(${t.origin} = 'suggested') = (${t.ruleId} is not null)`,
      ),
      // Retirar e acrescentar exigem justificativa do médico (MED-15).
      check(
        "ck_exam_plan_items_justification",
        sql`(${t.decision} = 'kept' and ${t.origin} = 'suggested') or ${t.justification} is not null`,
      ),
      pgPolicy("exam_plan_items_isolation", {
        for: "all",
        to: appRuntimeRole,
        using: tenantScope,
        withCheck: tenantScope,
      }),
      pgPolicy("exam_plan_items_module_access", {
        as: "restrictive",
        for: "all",
        to: appRuntimeRole,
        using: companyModuleScope(t.orgId, t.companyId, "medicine"),
        withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
      }),
      // Itens só entram em rascunho: sugeridos pela equipe ao preparar; acrescentados só pela coordenadora.
      pgPolicy("exam_plan_items_insert", {
        as: "restrictive",
        for: "insert",
        to: appRuntimeRole,
        withCheck: sql`${draftPlan} and ${t.createdBy} = ${actor} and (${t.origin} = 'suggested' or ${coordinator})`,
      }),
      // Decisões (manter, retirar, periodicidade) só da coordenadora, e só em rascunho.
      pgPolicy("exam_plan_items_coordinator_update", {
        as: "restrictive",
        for: "update",
        to: appRuntimeRole,
        using: sql`${draftPlan} and ${coordinator}`,
        withCheck: sql`${draftPlan} and ${coordinator} and ${t.updatedBy} = ${actor}`,
      }),
    ];
  },
).enableRLS();

/** Trilha das decisões médicas do plano (append-only). */
export const medicalExamPlanEvents = pgTable(
  "medical_exam_plan_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    planId: uuid("plan_id").notNull(),
    actor: text("actor").notNull(),
    event: text("event").notNull(),
    details: jsonb("details").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.planId, t.orgId, t.companyId],
      foreignColumns: [
        medicalExamPlans.id,
        medicalExamPlans.orgId,
        medicalExamPlans.companyId,
      ],
    }).onDelete("restrict"),
    index("idx_exam_plan_events_plan").on(t.orgId, t.planId, t.createdAt),
    pgPolicy("exam_plan_events_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("exam_plan_events_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    pgPolicy("exam_plan_events_actor_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.actor} = ${actor}`,
    }),
  ],
).enableRLS();

export type MedicalExamPlan = InferSelectModel<typeof medicalExamPlans>;
export type MedicalExamPlanItem = InferSelectModel<typeof medicalExamPlanItems>;
export type MedicalExamPlanEvent = InferSelectModel<typeof medicalExamPlanEvents>;
