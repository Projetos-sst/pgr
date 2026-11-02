import { sql, type InferSelectModel } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { appRuntimeRole } from "../roles";
import { companies } from "./companies";
import { healthExams } from "./health-exams";
import { companyModuleScope } from "./module-policy";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

/**
 * Prévias arquivadas do ASO (NOB-152). Cada versão é um arquivo imutável: conteúdo JSON com hash
 * SHA-256, montado só com os dados do exame realmente cadastrados (NR-7 7.5.19.1). Só existe o
 * status `preview`: emitir o ASO exige a assinatura do médico examinador por mecanismo
 * verificável (MED-12), que ainda não existe — o CHECK impede gravar outro status. Sem UPDATE nem
 * DELETE para o `app_runtime`; a FK para o exame não cascateia, então o histórico não some junto
 * com o exame ou o funcionário.
 */
export const asoDocuments = pgTable(
  "aso_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    healthExamId: uuid("health_exam_id").notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull().default("preview"),
    content: jsonb("content").notNull(),
    contentSha256: text("content_sha256").notNull(),
    generatedBy: text("generated_by").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_aso_documents_version").on(t.orgId, t.healthExamId, t.version),
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.healthExamId, t.orgId, t.companyId],
      foreignColumns: [healthExams.id, healthExams.orgId, healthExams.companyId],
    }),
    index("idx_aso_documents_exam").on(t.orgId, t.healthExamId, t.version),
    check("ck_aso_documents_status", sql`${t.status} = 'preview'`),
    check("ck_aso_documents_version", sql`${t.version} > 0`),
    check("ck_aso_documents_hash", sql`${t.contentSha256} ~ '^[0-9a-f]{64}$'`),
    pgPolicy("aso_documents_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("aso_documents_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    // A prévia só nasce de exame com médico examinador, com o ator como autor.
    pgPolicy("aso_documents_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.generatedBy} = current_setting('app.current_actor', true) and exists (select 1 from public.health_exams h where h.id = ${t.healthExamId} and h.org_id = ${t.orgId} and h.company_id = ${t.companyId} and h.doctor_id is not null)`,
    }),
  ],
).enableRLS();

export type AsoDocument = InferSelectModel<typeof asoDocuments>;

/**
 * Confirmação de apto/inapto pelo médico examinador (NOB-152, MED-01, MED-10). Exigida quando o
 * exame registra "apto com restrição": a NR-7 7.5.19.1 e pede apto ou inapto e o sistema não
 * converte a conclusão. Só a conta vinculada (NOB-149) ao médico examinador do exame confirma, e só
 * enquanto o registro do exame continua "apto com restrição". O registro original não é alterado.
 * Só inclusão: a confirmação vigente é a mais recente que ainda corresponde ao exame.
 */
export const asoExaminerConclusions = pgTable(
  "aso_examiner_conclusions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    healthExamId: uuid("health_exam_id").notNull(),
    conclusion: text("conclusion").$type<"fit" | "unfit">().notNull(),
    recordedAptitude: text("recorded_aptitude").notNull(),
    // Proveniência: sem FK, para a confirmação sobreviver a mudanças no cadastro do médico.
    examinerMedicoId: uuid("examiner_medico_id").notNull(),
    confirmedBy: text("confirmed_by").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.healthExamId, t.orgId, t.companyId],
      foreignColumns: [healthExams.id, healthExams.orgId, healthExams.companyId],
    }),
    index("idx_aso_examiner_conclusions_exam").on(t.orgId, t.healthExamId, t.confirmedAt),
    check("ck_aso_examiner_conclusions_value", sql`${t.conclusion} in ('fit','unfit')`),
    check(
      "ck_aso_examiner_conclusions_recorded",
      sql`${t.recordedAptitude} = 'fit_with_restrictions'`,
    ),
    pgPolicy("aso_examiner_conclusions_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("aso_examiner_conclusions_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    // Só a conta vinculada ao médico examinador do exame, enquanto o exame registra
    // "apto com restrição"; o papel no escritório não substitui o vínculo.
    pgPolicy("aso_examiner_conclusions_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.confirmedBy} = current_setting('app.current_actor', true) and exists (select 1 from public.health_exams h
        join public.medico_user_links l on l.org_id = h.org_id and l.medico_id = h.doctor_id and l.revoked_at is null
        join public.medicos m on m.id = h.doctor_id and m.org_id = h.org_id and m.status = 'active' and m.profession = 'physician'
        join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
        where h.id = ${t.healthExamId} and h.org_id = ${t.orgId} and h.company_id = ${t.companyId}
          and h.doctor_id = ${t.examinerMedicoId} and h.aptitude::text = ${t.recordedAptitude}
          and l.user_id = current_setting('app.current_actor', true))`,
    }),
  ],
).enableRLS();

export type AsoExaminerConclusion = InferSelectModel<typeof asoExaminerConclusions>;
