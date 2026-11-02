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
  uuid,
} from "drizzle-orm/pg-core";

import { appRuntimeRole } from "../roles";
import { companies } from "./companies";
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
    // Uma declaração por fonte, GES e função: repetir não cria nova "vigência".
    unique("uq_risk_absence_scope").on(t.orgId, t.sourceId, t.gesId, t.jobRole),
    index("idx_risk_absence_company").on(t.orgId, t.companyId, t.declaredAt),
    check(
      "ck_risk_absence_justification",
      sql`char_length(btrim(${t.justification})) >= 20`,
    ),
    check("ck_risk_absence_job_role", sql`${t.jobRole} = btrim(${t.jobRole})`),
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
  ],
).enableRLS();

export type MedicalRiskAbsenceDeclaration = InferSelectModel<
  typeof medicalRiskAbsenceDeclarations
>;
