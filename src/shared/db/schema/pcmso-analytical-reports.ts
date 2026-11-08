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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { appRuntimeRole } from "../roles";
import { companies } from "./companies";
import { coordinatorAssignmentInForceToday } from "./coordinator-in-force";
import { companyModuleScope } from "./module-policy";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;
const actor = sql`current_setting('app.current_actor', true)`;

/**
 * Relatório analítico anual do PCMSO (NR-7 7.6.2 a 7.6.6; NOB-154). Elaborado pelo médico
 * coordenador: só a conta vinculada a ele, com designação em vigor hoje, gera a versão. Cada
 * versão é um arquivo imutável (JSON com SHA-256), só com dados consolidados, nunca individuais.
 * Só existe o status `preview` (sem assinatura verificável, MED-12). Sem UPDATE nem DELETE para o
 * `app_runtime`.
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
    // Elaboração pelo médico coordenador (7.6.2): conta vinculada à designação em vigor hoje
    // (única; NOB-109), em nome dele.
    pgPolicy("pcmso_analytical_reports_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      // NOB-158: coordenador com identidade verificada (função central).
      withCheck: sql`${t.generatedBy} = ${actor} and exists (select 1 from public.pcmso_coordinator_assignments a
        where a.org_id = ${t.orgId} and a.company_id = ${t.companyId}
          and ${coordinatorAssignmentInForceToday("a")}
          and a.medico_id = ${t.authoredByMedicoId}
          and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id)))`,
    }),
  ],
).enableRLS();

export type PcmsoAnalyticalReport = InferSelectModel<typeof pcmsoAnalyticalReports>;

export type ReportEventKind = "finalized" | "presented" | "discussed" | "voided";
export type ReportCipaSituation =
  | "participated"
  | "exists_not_participated"
  | "not_constituted"
  | "unknown";

/**
 * Finalização, apresentação e discussão do relatório analítico (NOB-168; NR-7 7.6.5: o relatório
 * deve ser apresentado e discutido com os responsáveis por SST da organização, incluindo a CIPA,
 * quando existente). Eventos só de inclusão, ligados à versão exata do relatório (id e hash):
 * - `finalized`: o médico responsável que elaborou a versão (conta vinculada e verificada) a
 *   declara final e apta à apresentação; a prévia sozinha não é apresentada;
 * - `presented`: apresentação efetivamente realizada (data, modalidade, funções representadas,
 *   situação da CIPA, referência da ata); agendar ou gerar arquivo não conta;
 * - `discussed`: discussão efetiva (síntese agregada, medidas e encaminhamentos propostos, que não
 *   viram "executados" por terem sido discutidos);
 * - `voided`: correção de um registro, com motivo. Dados mínimos; nada clínico individual.
 */
export const pcmsoAnalyticalReportEvents = pgTable(
  "pcmso_analytical_report_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    reportId: uuid("report_id").notNull(),
    reportSha256: text("report_sha256").notNull(),
    kind: text("kind").$type<ReportEventKind>().notNull(),
    occurredOn: date("occurred_on"),
    modality: text("modality").$type<"in_person" | "remote" | "hybrid">(),
    participants: jsonb("participants").$type<{ role: string; name?: string }[]>(),
    cipaSituation: text("cipa_situation").$type<ReportCipaSituation>(),
    cipaReference: text("cipa_reference"),
    summary: text("summary"),
    measures:
      jsonb("measures").$type<
        { description: string; responsible?: string; dueDate?: string }[]
      >(),
    evidenceReference: text("evidence_reference"),
    note: text("note"),
    /** Ato de que este depende: apresentação → finalização; discussão → apresentação. */
    basisId: uuid("basis_id"),
    voidsId: uuid("voids_id"),
    voidReason: text("void_reason"),
    recordedBy: text("recorded_by").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "fk_report_events_company",
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_report_events_report",
      columns: [t.reportId, t.orgId, t.companyId],
      foreignColumns: [
        pcmsoAnalyticalReports.id,
        pcmsoAnalyticalReports.orgId,
        pcmsoAnalyticalReports.companyId,
      ],
    }),
    uniqueIndex("uq_report_events_id_scope").on(t.id, t.orgId, t.reportId),
    foreignKey({
      name: "fk_report_events_voids",
      columns: [t.voidsId, t.orgId, t.reportId],
      foreignColumns: [t.id, t.orgId, t.reportId],
    }),
    uniqueIndex("uq_report_events_voids").on(t.voidsId),
    // Apresentação e discussão apontam para o ato de base do mesmo relatório (cronologia no trigger).
    foreignKey({
      name: "fk_report_events_basis",
      columns: [t.basisId, t.orgId, t.reportId],
      foreignColumns: [t.id, t.orgId, t.reportId],
    }),
    index("idx_report_events_basis").on(t.basisId),
    index("idx_report_events_company").on(t.orgId, t.companyId, t.recordedAt),
    check(
      "ck_report_events_kind",
      sql`${t.kind} in ('finalized','presented','discussed','voided')`,
    ),
    check("ck_report_events_hash", sql`${t.reportSha256} ~ '^[0-9a-f]{64}$'`),
    // Apresentação e discussão: data e participantes obrigatórios; só elas os têm.
    check(
      "ck_report_events_meeting",
      sql`(${t.kind} in ('presented','discussed')) = (${t.occurredOn} is not null)
        and (${t.kind} in ('presented','discussed')) = (${t.participants} is not null)
        and (${t.participants} is null or (jsonb_typeof(${t.participants}) = 'array' and jsonb_array_length(${t.participants}) > 0))`,
    ),
    // Apresentação: modalidade e situação da CIPA; "sem CIPA" exige a referência da verificação.
    check(
      "ck_report_events_presented",
      sql`(${t.kind} = 'presented') = (${t.modality} is not null)
        and (${t.kind} = 'presented') = (${t.cipaSituation} is not null)
        and (${t.modality} is null or ${t.modality} in ('in_person','remote','hybrid'))
        and (${t.cipaSituation} is null or ${t.cipaSituation} in ('participated','exists_not_participated','not_constituted','unknown'))
        and (${t.cipaSituation} is distinct from 'not_constituted' or char_length(btrim(coalesce(${t.cipaReference}, ''))) >= 5)`,
    ),
    // Discussão: síntese obrigatória; medidas só na discussão.
    check(
      "ck_report_events_discussed",
      sql`(${t.kind} = 'discussed') = (${t.summary} is not null)
        and (${t.summary} is null or char_length(btrim(${t.summary})) >= 10)
        and (${t.measures} is null or (${t.kind} = 'discussed' and jsonb_typeof(${t.measures}) = 'array'))`,
    ),
    check(
      "ck_report_events_basis",
      sql`(${t.kind} in ('presented','discussed')) = (${t.basisId} is not null)`,
    ),
    check(
      "ck_report_events_void",
      sql`(${t.kind} = 'voided') = (${t.voidsId} is not null)
        and (${t.voidsId} is null) = (${t.voidReason} is null)
        and (${t.voidReason} is null or char_length(btrim(${t.voidReason})) >= 10)
        and (${t.voidsId} is null or ${t.voidsId} <> ${t.id})`,
    ),
    pgPolicy("report_events_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("report_events_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    // Ator como autor; versão exata (hash) da empresa; a mais recente (exceto correção). Finalizar:
    // só o médico responsável que elaborou a versão, verificado e ainda designado. Demais: equipe
    // do escritório. Regras que dependem de outros eventos ficam no trigger (sem recursão).
    pgPolicy("report_events_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.recordedBy} = ${actor}
        and exists (select 1 from public.pcmso_analytical_reports r where r.id = ${t.reportId} and r.org_id = ${t.orgId}
          and r.company_id = ${t.companyId} and r.content_sha256 = ${t.reportSha256}
          and (${t.kind} = 'voided' or not exists (select 1 from public.pcmso_analytical_reports n
            where n.org_id = r.org_id and n.company_id = r.company_id and n.version > r.version)))
        and (
          (${t.kind} = 'finalized' and exists (select 1 from public.pcmso_analytical_reports r
            join public.pcmso_coordinator_assignments a on a.org_id = r.org_id and a.company_id = r.company_id
              and a.medico_id = r.authored_by_medico_id and ${coordinatorAssignmentInForceToday("a")}
            where r.id = ${t.reportId} and r.org_id = ${t.orgId}
              and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id))))
          or (${t.kind} <> 'finalized' and exists (select 1 from public.org_memberships om where om.org_id = ${t.orgId}
            and om.user_id = ${actor} and om.role in ('owner','collaborator','org:admin','org:member')))
        )`,
    }),
  ],
).enableRLS();

export type PcmsoAnalyticalReportEvent = InferSelectModel<
  typeof pcmsoAnalyticalReportEvents
>;
