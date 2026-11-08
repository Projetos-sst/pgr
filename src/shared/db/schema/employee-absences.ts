import { sql, type InferSelectModel } from "drizzle-orm";
import {
  check,
  date,
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
import { coordinatorAssignmentInForceToday } from "./coordinator-in-force";
import { employees } from "./employees";
import { companyModuleScope } from "./module-policy";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;
const actor = sql`current_setting('app.current_actor', true)`;

/**
 * Afastamento ADMINISTRATIVO do funcionário (NOB-139, MED-23): período, causa geral e retorno
 * confirmado. Nunca guarda CID, diagnóstico ou atestado (área clínica separada abaixo). O alerta de
 * exame de retorno (NR-7 7.5.9) é derivado na leitura e sempre é sugestão para o médico.
 * - `ends_on`: último dia de ausência, quando conhecido (pode ser previsto); nulo = em andamento sem
 *   data de fim;
 * - `returned_on`: primeiro dia de volta ao trabalho, só quando o retorno é confirmado;
 * - `work_relation`: a relação com o trabalho só é registrada se informada; o sistema não decide
 *   nexo. Para "outro motivo", fica "não determinada".
 * Sem DELETE: registro errado é cancelado com motivo, e cada mudança fica nos eventos.
 */
export const employeeAbsences = pgTable(
  "employee_absences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    employeeId: uuid("employee_id").notNull(),
    cause: text("cause").$type<"illness" | "accident" | "other">().notNull(),
    workRelation: text("work_relation")
      .$type<"occupational" | "non_occupational" | "not_determined">()
      .notNull()
      .default("not_determined"),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    returnedOn: date("returned_on"),
    returnRecordedBy: text("return_recorded_by"),
    returnRecordedAt: timestamp("return_recorded_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: text("cancelled_by"),
    cancelReason: text("cancel_reason"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastChangedBy: text("last_changed_by").notNull(),
    lastChangedAt: timestamp("last_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "fk_employee_absences_company",
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_employee_absences_employee",
      columns: [t.employeeId],
      foreignColumns: [employees.id],
    }).onDelete("cascade"),
    unique("uq_employee_absences_identity").on(t.id, t.orgId, t.companyId),
    index("idx_employee_absences_employee").on(t.orgId, t.employeeId, t.startsOn),
    check(
      "ck_employee_absences_cause",
      sql`${t.cause} in ('illness','accident','other')`,
    ),
    check(
      "ck_employee_absences_relation",
      sql`${t.workRelation} in ('occupational','non_occupational','not_determined') and (${t.cause} <> 'other' or ${t.workRelation} = 'not_determined')`,
    ),
    check(
      "ck_employee_absences_period",
      sql`${t.endsOn} is null or ${t.endsOn} >= ${t.startsOn}`,
    ),
    // Retorno confirmado fecha o período: o último dia de ausência é a véspera do retorno.
    check(
      "ck_employee_absences_return",
      sql`(${t.returnedOn} is null and ${t.returnRecordedBy} is null and ${t.returnRecordedAt} is null) or (${t.returnedOn} > ${t.startsOn} and ${t.endsOn} = ${t.returnedOn} - 1 and ${t.returnRecordedBy} is not null and ${t.returnRecordedAt} is not null)`,
    ),
    check(
      "ck_employee_absences_cancel",
      sql`(${t.cancelledAt} is null) = (${t.cancelledBy} is null) and (${t.cancelledAt} is null) = (${t.cancelReason} is null)`,
    ),
    pgPolicy("employee_absences_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("employee_absences_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    pgPolicy("employee_absences_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.createdBy} = ${actor} and ${t.lastChangedBy} = ${actor} and ${t.returnedOn} is null and ${t.cancelledAt} is null`,
    }),
    // Só afastamento aberto (sem retorno confirmado e não cancelado) muda; o autor é o ator.
    pgPolicy("employee_absences_update", {
      as: "restrictive",
      for: "update",
      to: appRuntimeRole,
      using: sql`${t.returnedOn} is null and ${t.cancelledAt} is null`,
      withCheck: sql`${t.lastChangedBy} = ${actor}`,
    }),
  ],
).enableRLS();

export type EmployeeAbsence = InferSelectModel<typeof employeeAbsences>;

/** Histórico do afastamento (só inclusão): criação, data de fim, retorno e cancelamento. */
export const employeeAbsenceEvents = pgTable(
  "employee_absence_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    companyId: uuid("company_id").notNull(),
    absenceId: uuid("absence_id").notNull(),
    kind: text("kind")
      .$type<"created" | "end_updated" | "returned" | "cancelled">()
      .notNull(),
    endsOn: date("ends_on"),
    returnedOn: date("returned_on"),
    actorUserId: text("actor_user_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "fk_employee_absence_events_absence",
      columns: [t.absenceId, t.orgId, t.companyId],
      foreignColumns: [
        employeeAbsences.id,
        employeeAbsences.orgId,
        employeeAbsences.companyId,
      ],
    }).onDelete("cascade"),
    index("idx_employee_absence_events_absence").on(t.orgId, t.absenceId, t.occurredAt),
    check(
      "ck_employee_absence_events_kind",
      sql`${t.kind} in ('created','end_updated','returned','cancelled')`,
    ),
    pgPolicy("employee_absence_events_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("employee_absence_events_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    pgPolicy("employee_absence_events_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.actorUserId} = ${actor}`,
    }),
  ],
).enableRLS();

export type EmployeeAbsenceEvent = InferSelectModel<typeof employeeAbsenceEvents>;

/**
 * Conta da sessão é o coordenador do PCMSO da empresa: vínculo aberto (NOB-149/157), médico ativo,
 * associação viva e designação em vigor hoje, única (NOB-109). Papel no escritório não substitui o
 * vínculo.
 */
const coordinatorFor = (orgId: unknown, companyId: unknown, medico?: unknown) => {
  const sameMedico = medico ? sql` and a.medico_id = ${medico}` : sql``;
  // NOB-158: coordenador com identidade verificada (função central), nunca o vínculo sozinho.
  return sql`exists (select 1 from public.pcmso_coordinator_assignments a
        where a.org_id = ${orgId} and a.company_id = ${companyId}${sameMedico}
          and ${coordinatorAssignmentInForceToday("a")}
          and a.medico_id in (select public.actor_clinical_medico_ids(a.org_id)))`;
};

/**
 * Área clínica do afastamento (NOB-139, MED-17, DT-21): atestado e CID. Só a conta vinculada ao
 * coordenador do PCMSO da empresa lê e grava (servidor e RLS). O CID só é guardado com a
 * autorização do trabalhador registrada. Só inclusão; a FK não cascateia (guarda do registro).
 */
export const employeeAbsenceClinicalNotes = pgTable(
  "employee_absence_clinical_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    companyId: uuid("company_id").notNull(),
    absenceId: uuid("absence_id").notNull(),
    cid: text("cid"),
    workerAuthorization: text("worker_authorization"),
    content: text("content"),
    // Proveniência: sem FK, para a autoria sobreviver a mudanças no cadastro do médico.
    authoredByMedicoId: uuid("authored_by_medico_id").notNull(),
    recordedBy: text("recorded_by").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "fk_absence_clinical_notes_absence",
      columns: [t.absenceId, t.orgId, t.companyId],
      foreignColumns: [
        employeeAbsences.id,
        employeeAbsences.orgId,
        employeeAbsences.companyId,
      ],
    }).onDelete("restrict"),
    index("idx_absence_clinical_notes_absence").on(t.orgId, t.absenceId, t.recordedAt),
    check(
      "ck_absence_clinical_notes_cid",
      sql`${t.cid} is null or (${t.cid} ~ '^[A-TV-Z][0-9]{2}(\\.[0-9A-Z]{1,2})?$' and ${t.workerAuthorization} is not null and btrim(${t.workerAuthorization}) <> '')`,
    ),
    check(
      "ck_absence_clinical_notes_content",
      sql`${t.cid} is not null or (${t.content} is not null and btrim(${t.content}) <> '')`,
    ),
    pgPolicy("absence_clinical_notes_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("absence_clinical_notes_coordinator", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: coordinatorFor(t.orgId, t.companyId),
      withCheck: coordinatorFor(t.orgId, t.companyId),
    }),
    pgPolicy("absence_clinical_notes_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.recordedBy} = ${actor} and ${coordinatorFor(t.orgId, t.companyId, t.authoredByMedicoId)}`,
    }),
  ],
).enableRLS();

export type EmployeeAbsenceClinicalNote = InferSelectModel<
  typeof employeeAbsenceClinicalNotes
>;

/** Trilha de acesso à área clínica do afastamento: quem, quando, qual ação; nunca o conteúdo. */
export const absenceClinicalAccessEvents = pgTable(
  "absence_clinical_access_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull(),
    absenceId: uuid("absence_id").notNull(),
    medicoId: uuid("medico_id").notNull(),
    action: text("action").$type<"read" | "note_added">().notNull(),
    actorUserId: text("actor_user_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_absence_clinical_access_absence").on(t.orgId, t.absenceId, t.occurredAt),
    check("ck_absence_clinical_access_action", sql`${t.action} in ('read','note_added')`),
    pgPolicy("absence_clinical_access_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("absence_clinical_access_read", {
      as: "restrictive",
      for: "select",
      to: appRuntimeRole,
      using: sql`exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = ${actor} and m.role in ('owner','org:admin')) or ${t.actorUserId} = ${actor}`,
    }),
    pgPolicy("absence_clinical_access_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.actorUserId} = ${actor} and ${coordinatorFor(t.orgId, t.companyId, t.medicoId)}`,
    }),
  ],
).enableRLS();
