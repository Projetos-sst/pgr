import { sql, type InferSelectModel } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { appRuntimeRole } from "../roles";
import { companies } from "./companies";
import { companyModuleScope } from "./module-policy";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;
const actor = sql`current_setting('app.current_actor', true)`;

/**
 * Critérios de interpretação dos achados e planejamento das condutas por exame (NR-7 7.5.4 c;
 * NOB-153). Texto de autoria do médico coordenador do PCMSO: o sistema não gera nem sugere
 * (DT-23). Cada definição é uma versão imutável por procedimento; a vigente é a mais recente.
 * Só inclusão para o `app_runtime`.
 */
export const pcmsoInterpretationCriteria = pgTable(
  "pcmso_interpretation_criteria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    procedureCode: text("procedure_code").notNull(),
    otherDescription: text("other_description"),
    version: integer("version").notNull(),
    criteria: text("criteria").notNull(),
    conduct: text("conduct").notNull(),
    // Proveniência: sem FK, para a autoria sobreviver a mudanças no cadastro do médico.
    authoredByMedicoId: uuid("authored_by_medico_id").notNull(),
    authoredByUser: text("authored_by_user").notNull(),
    authoredAt: timestamp("authored_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    unique("uq_pcmso_interpretation_criteria_version")
      .on(t.orgId, t.companyId, t.procedureCode, t.otherDescription, t.version)
      .nullsNotDistinct(),
    index("idx_pcmso_interpretation_criteria_company").on(
      t.orgId,
      t.companyId,
      t.procedureCode,
    ),
    check(
      "ck_pcmso_interpretation_criteria_code",
      sql`${t.procedureCode} ~ '^[0-9]{4}$'`,
    ),
    check(
      "ck_pcmso_interpretation_criteria_other",
      sql`(${t.procedureCode} = '9999') = (${t.otherDescription} is not null)`,
    ),
    check("ck_pcmso_interpretation_criteria_version", sql`${t.version} > 0`),
    check(
      "ck_pcmso_interpretation_criteria_text",
      sql`length(btrim(${t.criteria})) > 0 and length(btrim(${t.conduct})) > 0`,
    ),
    pgPolicy("pcmso_interpretation_criteria_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("pcmso_interpretation_criteria_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    // Só a conta vinculada ao coordenador com designação aberta, em nome desse médico.
    pgPolicy("pcmso_interpretation_criteria_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.authoredByUser} = ${actor} and exists (select 1 from public.pcmso_coordinator_assignments a
        join public.medico_user_links l on l.org_id = a.org_id and l.medico_id = a.medico_id and l.revoked_at is null
        join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id and m.status = 'active'
        join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
        where a.org_id = ${t.orgId} and a.company_id = ${t.companyId} and a.ends_on is null
          and a.medico_id = ${t.authoredByMedicoId} and l.user_id = ${actor})`,
    }),
  ],
).enableRLS();

export type PcmsoInterpretationCriterion = InferSelectModel<
  typeof pcmsoInterpretationCriteria
>;
