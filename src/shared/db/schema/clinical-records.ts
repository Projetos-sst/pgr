import { sql, type InferSelectModel, type SQL, type SQLWrapper } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { appRuntimeRole } from "../roles";
import { coordinatorAssignmentInForceToday } from "./coordinator-in-force";
import { healthExams } from "./health-exams";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;
const actor = sql`current_setting('app.current_actor', true)`;
// Mesmo predicado de owner da 0056 (NOB-98).
const actorIsOwner = sql`exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin'))`;

/**
 * Conta da sessão autorizada a acessar o prontuário do exame (NOB-155, DT-21): vínculo aberto
 * (NOB-149) com médico ativo e associação viva ao escritório, e esse médico é o examinador do
 * exame ou o coordenador com designação em vigor hoje (única; NOB-109) da empresa onde o exame foi
 * realizado (MED-07). Papel no escritório (owner, colaborador) não substitui o vínculo. Com
 * `medico`, exige também que o médico registrado na linha seja o da conta.
 */
function clinicianFor(orgId: SQLWrapper, examId: SQLWrapper, medico?: SQLWrapper): SQL {
  const sameMedico = medico ? sql` and c.medico_id = ${medico}` : sql``;
  // NOB-158: só profissional com identidade verificada (função central), nunca o vínculo sozinho.
  return sql`exists (select 1 from public.health_exams h
        join lateral public.actor_clinical_medico_ids(h.org_id) c(medico_id) on true
        where h.id = ${examId} and h.org_id = ${orgId}${sameMedico}
          and (h.doctor_id = c.medico_id or exists (select 1 from public.pcmso_coordinator_assignments a
            where a.org_id = h.org_id and a.company_id = h.company_id and a.medico_id = c.medico_id
              and ${coordinatorAssignmentInForceToday("a")})))`;
}

/**
 * Prontuário clínico do exame (NOB-155, DT-21, MED-10/17): observações clínicas e informações
 * sensíveis, fora do cadastro de exames. Só a conta vinculada ao médico examinador do exame ou ao
 * coordenador da empresa lê e grava (servidor e RLS). Só inclusão: correção é um novo registro, e
 * o histórico fica. `legacy_exam_notes` são as antigas observações de `health_exams.notes`,
 * migradas pela 0067 sem autoria médica presumida. A FK não cascateia: exame com prontuário não
 * é apagado (guarda do prontuário, NR-7 7.4.5).
 */
export const healthExamClinicalNotes = pgTable(
  "health_exam_clinical_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    healthExamId: uuid("health_exam_id").notNull(),
    origin: text("origin").$type<"clinician" | "legacy_exam_notes">().notNull(),
    content: text("content").notNull(),
    // Proveniência: sem FK, para a autoria sobreviver a mudanças no cadastro do médico.
    authoredByMedicoId: uuid("authored_by_medico_id"),
    recordedBy: text("recorded_by"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "fk_health_exam_clinical_notes_exam",
      columns: [t.healthExamId, t.orgId],
      foreignColumns: [healthExams.id, healthExams.orgId],
    }).onDelete("restrict"),
    index("idx_health_exam_clinical_notes_exam").on(
      t.orgId,
      t.healthExamId,
      t.recordedAt,
    ),
    check(
      "ck_health_exam_clinical_notes_origin",
      sql`${t.origin} in ('clinician','legacy_exam_notes')`,
    ),
    check(
      "ck_health_exam_clinical_notes_authorship",
      sql`(${t.origin} = 'clinician') = (${t.recordedBy} is not null and ${t.authoredByMedicoId} is not null)`,
    ),
    check(
      "ck_health_exam_clinical_notes_content",
      sql`${t.origin} = 'legacy_exam_notes' or btrim(${t.content}) <> ''`,
    ),
    pgPolicy("health_exam_clinical_notes_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("health_exam_clinical_notes_clinician", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: clinicianFor(t.orgId, t.healthExamId),
      withCheck: clinicianFor(t.orgId, t.healthExamId),
    }),
    pgPolicy("health_exam_clinical_notes_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.origin} = 'clinician' and ${t.recordedBy} = ${actor} and ${clinicianFor(t.orgId, t.healthExamId, t.authoredByMedicoId)}`,
    }),
  ],
).enableRLS();

export type HealthExamClinicalNote = InferSelectModel<typeof healthExamClinicalNotes>;

/**
 * Comunicação ao RH das restrições necessárias ao trabalho (NOB-155, MED-17, DT-21): texto
 * funcional escrito pelo médico examinador ou coordenador, sem diagnóstico nem CID. É o único
 * conteúdo do médico que o RH (owner, colaborador) lê. Só inclusão; a vigente é a mais recente,
 * e `withdrawal` registra que as restrições deixaram de valer.
 */
export const healthExamWorkRestrictions = pgTable(
  "health_exam_work_restrictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    healthExamId: uuid("health_exam_id").notNull(),
    kind: text("kind").$type<"restriction" | "withdrawal">().notNull(),
    restriction: text("restriction"),
    authoredByMedicoId: uuid("authored_by_medico_id").notNull(),
    recordedBy: text("recorded_by").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "fk_health_exam_work_restrictions_exam",
      columns: [t.healthExamId, t.orgId],
      foreignColumns: [healthExams.id, healthExams.orgId],
    }).onDelete("restrict"),
    index("idx_health_exam_work_restrictions_exam").on(
      t.orgId,
      t.healthExamId,
      t.recordedAt,
    ),
    check(
      "ck_health_exam_work_restrictions_kind",
      sql`(${t.kind} = 'restriction' and ${t.restriction} is not null and btrim(${t.restriction}) <> '') or (${t.kind} = 'withdrawal' and ${t.restriction} is null)`,
    ),
    pgPolicy("health_exam_work_restrictions_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    // O exame visível (RLS de módulo de `health_exams`) delimita a comunicação.
    pgPolicy("health_exam_work_restrictions_exam_scope", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: sql`exists (select 1 from public.health_exams h where h.id = ${t.healthExamId} and h.org_id = ${t.orgId})`,
      withCheck: sql`exists (select 1 from public.health_exams h where h.id = ${t.healthExamId} and h.org_id = ${t.orgId})`,
    }),
    pgPolicy("health_exam_work_restrictions_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.recordedBy} = ${actor} and ${clinicianFor(t.orgId, t.healthExamId, t.authoredByMedicoId)}`,
    }),
  ],
).enableRLS();

export type HealthExamWorkRestriction = InferSelectModel<
  typeof healthExamWorkRestrictions
>;

/**
 * Auditoria de acesso ao prontuário (NOB-155): quem leu ou gravou, com qual base (examinador ou
 * coordenador) e quando. Nunca guarda conteúdo clínico. Só inclusão; o evento só nasce de conta
 * autorizada, em nome dela. Lê o owner do escritório e a própria conta. Sem FK para o exame: a
 * trilha sobrevive ao cadastro.
 */
export const clinicalRecordAccessEvents = pgTable(
  "clinical_record_access_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    healthExamId: uuid("health_exam_id").notNull(),
    medicoId: uuid("medico_id").notNull(),
    basis: text("basis").$type<"examiner" | "coordinator">().notNull(),
    action: text("action")
      .$type<"read" | "note_added" | "restriction_recorded">()
      .notNull(),
    actorUserId: text("actor_user_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_clinical_record_access_events_exam").on(
      t.orgId,
      t.healthExamId,
      t.occurredAt,
    ),
    check(
      "ck_clinical_record_access_events_basis",
      sql`${t.basis} in ('examiner','coordinator')`,
    ),
    check(
      "ck_clinical_record_access_events_action",
      sql`${t.action} in ('read','note_added','restriction_recorded')`,
    ),
    pgPolicy("clinical_record_access_events_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("clinical_record_access_events_read", {
      as: "restrictive",
      for: "select",
      to: appRuntimeRole,
      using: sql`${actorIsOwner} or ${t.actorUserId} = ${actor}`,
    }),
    pgPolicy("clinical_record_access_events_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.actorUserId} = ${actor} and ${clinicianFor(t.orgId, t.healthExamId, t.medicoId)}`,
    }),
  ],
).enableRLS();

export type ClinicalRecordAccessEvent = InferSelectModel<
  typeof clinicalRecordAccessEvents
>;
