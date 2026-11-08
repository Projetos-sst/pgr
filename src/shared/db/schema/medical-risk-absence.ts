import { sql, type InferSelectModel } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { appRuntimeRole } from "../roles";
import { companies } from "./companies";
import { jobRoles } from "./job-roles";
import { medicalRiskSources } from "./medical-risk-sources";
import { companyModuleScope } from "./module-policy";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;
const actor = sql`current_setting('app.current_actor', true)`;

/**
 * Declaração de inexistência de riscos (NOB-156, DT-12, MED-09): o profissional com autorização
 * ativa de validação de riscos da empresa (NOB-98) declara que o GES, para uma função ou para o
 * grupo todo, não tem exposição a riscos que exijam controle médico, naquela versão da fonte.
 * Nunca é preenchida pelo sistema e não vale para outra fonte: fonte nova exige nova declaração.
 * Só inclusão (sem UPDATE/DELETE), com autor, data e justificativa. `ges_id` e o nome do grupo
 * ficam como proveniência, sem FK, para a declaração sobreviver a mudanças no cadastro.
 * `job_role` vazio = grupo todo.
 *
 * Função (NOB-112/NOB-110/NOB-156): `job_role_id` é a função cadastrada declarada, e é por ela
 * que o ASO casa a declaração (renomear a função não invalida a declaração). `job_role` guarda o
 * título no momento da declaração, como texto histórico. Declarações anteriores a esta coluna
 * podem ter só o texto (`job_role_id` nulo): a migração vincula só as inequívocas; as demais não
 * valem no ASO até nova declaração (regularização). Excluir a função zera só `job_role_id`
 * (ON DELETE SET NULL (job_role_id), SQL próprio da migração) e mantém o resto do histórico.
 */
export const medicalRiskAbsenceDeclarations = pgTable(
  "medical_risk_absence_declarations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    companyId: uuid("company_id").notNull(),
    sourceId: uuid("source_id").notNull(),
    gesId: uuid("ges_id").notNull(),
    exposureGroup: text("exposure_group").notNull(),
    jobRole: text("job_role").notNull().default(""),
    jobRoleId: uuid("job_role_id"),
    justification: text("justification").notNull(),
    declaredBy: text("declared_by").notNull(),
    declaredAt: timestamp("declared_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "fk_risk_absence_company",
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_risk_absence_source",
      columns: [t.sourceId, t.orgId, t.companyId],
      foreignColumns: [
        medicalRiskSources.id,
        medicalRiskSources.orgId,
        medicalRiskSources.companyId,
      ],
    }).onDelete("cascade"),
    // Mesmo tenant e mesma empresa da declaração. A migração troca o "set null" pela forma com
    // coluna (`ON DELETE SET NULL (job_role_id)`): zerar org/empresa violaria o NOT NULL.
    foreignKey({
      name: "fk_risk_absence_job_role",
      columns: [t.jobRoleId, t.orgId, t.companyId],
      foreignColumns: [jobRoles.id, jobRoles.orgId, jobRoles.companyId],
    }).onDelete("set null"),
    // Uma declaração por fonte, GES e função: repetir não cria nova "vigência".
    unique("uq_risk_absence_scope").on(t.orgId, t.sourceId, t.gesId, t.jobRole),
    // A mesma função cadastrada (pelo id) não é declarada duas vezes na mesma fonte e GES,
    // mesmo depois de renomeada.
    uniqueIndex("uq_risk_absence_scope_job_role")
      .on(t.orgId, t.sourceId, t.gesId, t.jobRoleId)
      .where(sql`${t.jobRoleId} is not null`),
    index("idx_risk_absence_job_role").on(t.jobRoleId),
    index("idx_risk_absence_company").on(t.orgId, t.companyId, t.declaredAt),
    check(
      "ck_risk_absence_justification",
      sql`char_length(btrim(${t.justification})) >= 20`,
    ),
    check("ck_risk_absence_job_role", sql`${t.jobRole} = btrim(${t.jobRole})`),
    // Grupo todo (título vazio) nunca aponta para uma função. Título sem id só nas declarações
    // antigas (legado): a policy de inclusão exige o id nas novas.
    check(
      "ck_risk_absence_job_role_id",
      sql`${t.jobRoleId} is null or ${t.jobRole} <> ''`,
    ),
    pgPolicy("risk_absence_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("risk_absence_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    // Só o profissional com autorização ativa nesta empresa (mesma regra da validação de riscos).
    pgPolicy("risk_absence_authorized_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.declaredBy} = ${actor} and exists (select 1 from public.professional_risk_authorizations a
        join public.org_memberships om on om.org_id = a.org_id and om.user_id = a.user_id
        where a.org_id = ${t.orgId} and a.company_id = ${t.companyId} and a.user_id = ${actor} and a.active = true
          and (om.scoped_company_id is null or om.scoped_company_id = ${t.companyId}))`,
    }),
    // Declaração nova: grupo todo, ou a função cadastrada (id) vinculada a este GES em
    // `ges_job_roles`, com o título atual dela. Texto sem id não entra mais (NOB-112).
    pgPolicy("risk_absence_job_role_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`(${t.jobRole} = '' and ${t.jobRoleId} is null) or exists (select 1 from public.ges_job_roles gjr
        join public.job_roles jr on jr.id = gjr.job_role_id and jr.org_id = gjr.org_id
        where gjr.org_id = ${t.orgId} and gjr.ges_id = ${t.gesId} and gjr.job_role_id = ${t.jobRoleId}
          and jr.company_id = ${t.companyId} and jr.title = ${t.jobRole})`,
    }),
  ],
).enableRLS();

export type MedicalRiskAbsenceDeclaration = InferSelectModel<
  typeof medicalRiskAbsenceDeclarations
>;
