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
