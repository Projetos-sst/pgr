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
import { companyModuleScope } from "./module-policy";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;
const actor = sql`current_setting('app.current_actor', true)`;

/**
 * Relatório analítico anual do PCMSO (NR-7 7.6.2 a 7.6.6; NOB-154). Elaborado pelo médico
 * coordenador: só a conta vinculada a ele, com designação aberta, gera a versão. Cada versão é um
 * arquivo imutável (JSON com SHA-256), só com dados consolidados, nunca individuais. Só existe o
 * status `preview` (sem assinatura verificável, MED-12). Sem UPDATE nem DELETE para o `app_runtime`.
 */
export const pcmsoAnalyticalReports = pgTable(
  "pcmso_analytical_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull().default("preview"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    previousReportId: uuid("previous_report_id"),
    content: jsonb("content").notNull(),
    contentSha256: text("content_sha256").notNull(),
    // Proveniência: sem FK, para a autoria sobreviver a mudanças no cadastro do médico.
    authoredByMedicoId: uuid("authored_by_medico_id").notNull(),
    generatedBy: text("generated_by").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_pcmso_analytical_reports_version").on(t.orgId, t.companyId, t.version),
    unique("uq_pcmso_analytical_reports_identity").on(t.id, t.orgId, t.companyId),
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.previousReportId, t.orgId, t.companyId],
      foreignColumns: [t.id, t.orgId, t.companyId],
    }),
    index("idx_pcmso_analytical_reports_company").on(t.orgId, t.companyId, t.periodEnd),
    check("ck_pcmso_analytical_reports_status", sql`${t.status} = 'preview'`),
    check("ck_pcmso_analytical_reports_version", sql`${t.version} > 0`),
    check("ck_pcmso_analytical_reports_period", sql`${t.periodEnd} >= ${t.periodStart}`),
    check("ck_pcmso_analytical_reports_hash", sql`${t.contentSha256} ~ '^[0-9a-f]{64}$'`),
    pgPolicy("pcmso_analytical_reports_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("pcmso_analytical_reports_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    // Elaboração pelo médico coordenador (7.6.2): conta vinculada à designação aberta, em nome dele.
    pgPolicy("pcmso_analytical_reports_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.generatedBy} = ${actor} and exists (select 1 from public.pcmso_coordinator_assignments a
        join public.medico_user_links l on l.org_id = a.org_id and l.medico_id = a.medico_id and l.revoked_at is null
        join public.medicos m on m.id = a.medico_id and m.org_id = a.org_id and m.status = 'active'
        join public.org_memberships om on om.org_id = l.org_id and om.user_id = l.user_id
        where a.org_id = ${t.orgId} and a.company_id = ${t.companyId} and a.ends_on is null
          and a.medico_id = ${t.authoredByMedicoId} and l.user_id = ${actor})`,
    }),
  ],
).enableRLS();

export type PcmsoAnalyticalReport = InferSelectModel<typeof pcmsoAnalyticalReports>;
