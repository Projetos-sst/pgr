import { sql, type InferSelectModel } from "drizzle-orm";
import {
  check,
  date,
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
import { medicalExamPlans } from "./medical-exam-plans";
import { companyModuleScope } from "./module-policy";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

/**
 * Versões do PCMSO composto (NOB-151). Cada versão é um arquivo imutável: conteúdo JSON com hash
 * SHA-256, plano de exames aprovado de origem e vigência. Só existe o status `preview`: emissão
 * oficial exige assinatura médica verificável (MED-12), que ainda não existe — o CHECK impede
 * gravar outro status. Sem UPDATE nem DELETE para o `app_runtime`.
 */
export const pcmsoDocuments = pgTable(
  "pcmso_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull().default("preview"),
    cycleStart: date("cycle_start").notNull(),
    cycleEnd: date("cycle_end").notNull(),
    examPlanId: uuid("exam_plan_id").notNull(),
    content: jsonb("content").notNull(),
    contentSha256: text("content_sha256").notNull(),
    generatedBy: text("generated_by").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_pcmso_documents_version").on(t.orgId, t.companyId, t.version),
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.examPlanId, t.orgId, t.companyId],
      foreignColumns: [
        medicalExamPlans.id,
        medicalExamPlans.orgId,
        medicalExamPlans.companyId,
      ],
    }).onDelete("restrict"),
    index("idx_pcmso_documents_company").on(t.orgId, t.companyId, t.version),
    check("ck_pcmso_documents_status", sql`${t.status} = 'preview'`),
    check("ck_pcmso_documents_version", sql`${t.version} > 0`),
    check("ck_pcmso_documents_cycle", sql`${t.cycleEnd} > ${t.cycleStart}`),
    check("ck_pcmso_documents_hash", sql`${t.contentSha256} ~ '^[0-9a-f]{64}$'`),
    pgPolicy("pcmso_documents_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("pcmso_documents_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    // A versão só pode nascer de um plano APROVADO da mesma empresa, com o ator como autor.
    pgPolicy("pcmso_documents_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.generatedBy} = current_setting('app.current_actor', true) and exists (select 1 from public.medical_exam_plans p where p.id = ${t.examPlanId} and p.org_id = ${t.orgId} and p.company_id = ${t.companyId} and p.status = 'approved')`,
    }),
  ],
).enableRLS();

export type PcmsoDocument = InferSelectModel<typeof pcmsoDocuments>;
