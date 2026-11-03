import {
  pgTable,
  pgEnum,
  text,
  uuid,
  date,
  timestamp,
  index,
  uniqueIndex,
  pgPolicy,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { sql, type InferInsertModel, type InferSelectModel, type SQL } from "drizzle-orm";

import { appRuntimeRole, identityVerifierRole } from "../roles";
import { identityVerified } from "./clinical-actor";
import { orgs } from "./orgs";
import { companies } from "./companies";
import { companyModuleScope } from "./module-policy";

export const medicoStatus = pgEnum("medico_status", ["active", "inactive"]);

/** Categoria profissional (NOB-121): médico (CRM) ou psicólogo (CRP). */
export const medicalProfession = pgEnum("medical_profession", [
  "physician",
  "psychologist",
]);

/** Vínculo com o escritório: equipe própria ou profissional externo (clínica, indicado pela empresa). */
export const medicalAffiliation = pgEnum("medical_affiliation", ["internal", "external"]);

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;
// Mesmo predicado de owner da 0056 (NOB-98): ator da sessão com papel owner no tenant.
const actorIsOwner = sql`exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin'))`;

/**
 * Cadastro de profissionais de saúde (médicos e psicólogos) do escritório,
 * isolado por tenant. `crm` guarda o número do registro no conselho da
 * profissão (CRM para médico, CRP para psicólogo) e `registration_uf` a UF do
 * conselho. `rqe` é o Registro de Qualificação de Especialista (Medicina do
 * Trabalho), só para médicos. `clinic` é a clínica/empregador do profissional
 * (texto livre — não é a empresa-cliente do tenant). Registro único por org.
 */
export const medicos = pgTable(
  "medicos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    crm: text("crm").notNull(),
    profession: medicalProfession("profession").notNull().default("physician"),
    registrationUf: text("registration_uf"),
    rqe: text("rqe"),
    affiliation: medicalAffiliation("affiliation").notNull().default("internal"),
    specialty: text("specialty"),
    clinic: text("clinic"),
    phone: text("phone"),
    status: medicoStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_medicos_org_id").on(table.orgId),
    uniqueIndex("uq_medicos_org_crm").on(table.orgId, table.crm),
    // Alvo das FKs compostas (id, org_id): impede vínculo com profissional de outro tenant.
    uniqueIndex("uq_medicos_id_org").on(table.id, table.orgId),
    check(
      "ck_medicos_registration_uf",
      sql`${table.registrationUf} is null or ${table.registrationUf} ~ '^[A-Z]{2}$'`,
    ),
    check(
      "ck_medicos_rqe_physician",
      sql`${table.rqe} is null or ${table.profession} = 'physician'`,
    ),
    pgPolicy("medicos_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    // NOB-158: o operador confere CRM/UF do cadastro (só leitura, sem dado clínico).
    pgPolicy("medicos_identity_verifier_read", {
      for: "select",
      to: identityVerifierRole,
      using: sql`true`,
    }),
  ],
).enableRLS();

export type Medico = InferSelectModel<typeof medicos>;
export type NewMedico = InferInsertModel<typeof medicos>;

/**
 * Designação do médico responsável (coordenador) pelo PCMSO de uma
 * empresa-cliente, por período (MED-02; NR-7 7.4.1 "c"). Histórico
 * preservado: trocar de coordenador encerra a designação aberta (`ends_on`)
 * e cria outra; o app_runtime não pode apagar linhas. No máximo uma
 * designação aberta por empresa. `rqe_exception_reason` registra a exceção do
 * NR-7 7.5.2 (sem médico do trabalho na localidade) quando o médico não tem RQE.
 */
export const pcmsoCoordinatorAssignments = pgTable(
  "pcmso_coordinator_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    companyId: uuid("company_id").notNull(),
    medicoId: uuid("medico_id").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    rqeExceptionReason: text("rqe_exception_reason"),
    endReason: text("end_reason"),
    createdBy: text("created_by").notNull(),
    endedBy: text("ended_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.medicoId, t.orgId],
      foreignColumns: [medicos.id, medicos.orgId],
    }).onDelete("restrict"),
    index("idx_pcmso_coordinators_company").on(t.orgId, t.companyId, t.startsOn),
    index("idx_pcmso_coordinators_medico").on(t.medicoId),
    uniqueIndex("uq_pcmso_coordinators_open")
      .on(t.orgId, t.companyId)
      .where(sql`${t.endsOn} is null`),
    check(
      "ck_pcmso_coordinators_period",
      sql`${t.endsOn} is null or ${t.endsOn} >= ${t.startsOn}`,
    ),
    check(
      "ck_pcmso_coordinators_end_reason",
      sql`(${t.endsOn} is null) = (${t.endReason} is null)`,
    ),
    pgPolicy("pcmso_coordinators_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("pcmso_coordinators_module_access", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: companyModuleScope(t.orgId, t.companyId, "medicine"),
      withCheck: companyModuleScope(t.orgId, t.companyId, "medicine"),
    }),
    pgPolicy("pcmso_coordinators_owner_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${actorIsOwner} and ${t.createdBy} = current_setting('app.current_actor', true)`,
    }),
    // Só uma designação ABERTA pode ser alterada (encerrada); encerrada não reabre nem muda.
    pgPolicy("pcmso_coordinators_owner_close", {
      as: "restrictive",
      for: "update",
      to: appRuntimeRole,
      using: sql`${t.endsOn} is null and ${actorIsOwner}`,
      withCheck: sql`${t.endedBy} = current_setting('app.current_actor', true)`,
    }),
  ],
).enableRLS();

export type PcmsoCoordinatorAssignment = InferSelectModel<
  typeof pcmsoCoordinatorAssignments
>;

/**
 * Convite para uma conta assumir a identidade do profissional (NOB-157). O owner convida; o
 * vínculo efetivo (`medico_user_links`) só nasce quando a própria conta convidada aceita, com login
 * próprio, e, se quem convidou é a própria conta convidada (autovínculo), quando outra conta owner
 * aprova. Só inclusão: aceite, recusa, aprovação e cancelamento são eventos.
 */
export const medicoLinkInvitations = pgTable(
  "medico_link_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    medicoId: uuid("medico_id").notNull(),
    userId: text("user_id").notNull(),
    reason: text("reason").notNull(),
    invitedBy: text("invited_by").notNull(),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '7 days'`),
  },
  (t) => [
    foreignKey({
      name: "fk_medico_link_invitations_medico",
      columns: [t.medicoId, t.orgId],
      foreignColumns: [medicos.id, medicos.orgId],
    }).onDelete("restrict"),
    // Alvo das FKs compostas dos eventos e do vínculo.
    uniqueIndex("uq_medico_link_invitations_id_org").on(t.id, t.orgId),
    index("idx_medico_link_invitations_medico").on(t.orgId, t.medicoId, t.invitedAt),
    index("idx_medico_link_invitations_user").on(t.orgId, t.userId),
    check("ck_medico_link_invitations_expiry", sql`${t.expiresAt} > ${t.invitedAt}`),
    pgPolicy("medico_link_invitations_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("medico_link_invitations_owner_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${actorIsOwner} and ${t.invitedBy} = current_setting('app.current_actor', true)`,
    }),
  ],
).enableRLS();

export type MedicoLinkInvitation = InferSelectModel<typeof medicoLinkInvitations>;

/** Convite (alias SQL) ainda aberto: sem recusa nem cancelamento e dentro da validade. */
function invitationOpen(alias: SQL): SQL {
  return sql`not exists (select 1 from public.medico_link_invitation_events c where c.org_id = ${alias}.org_id and c.invitation_id = ${alias}.id and c.kind in ('declined','cancelled')) and ${alias}.expires_at > now()`;
}

/**
 * Eventos do convite (NOB-157), um de cada tipo por convite:
 * - `accepted`/`declined`: só a própria conta convidada, com o convite aberto;
 * - `approved`: só no autovínculo, por outra conta owner, depois do aceite;
 * - `cancelled`: o owner encerra um convite aberto.
 * `statement` guarda a declaração de identidade aceita (nome e registro do cadastro): é
 * declaração autenticada da conta, não verificação do conselho profissional.
 */
export const medicoLinkInvitationEvents = pgTable(
  "medico_link_invitation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    invitationId: uuid("invitation_id").notNull(),
    kind: text("kind")
      .$type<"accepted" | "declined" | "approved" | "cancelled">()
      .notNull(),
    actorUserId: text("actor_user_id").notNull(),
    statement: text("statement"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "fk_medico_link_invitation_events_invitation",
      columns: [t.invitationId, t.orgId],
      foreignColumns: [medicoLinkInvitations.id, medicoLinkInvitations.orgId],
    }).onDelete("cascade"),
    uniqueIndex("uq_medico_link_invitation_events_kind").on(
      t.orgId,
      t.invitationId,
      t.kind,
    ),
    check(
      "ck_medico_link_invitation_events_kind",
      sql`${t.kind} in ('accepted','declined','approved','cancelled')`,
    ),
    check(
      "ck_medico_link_invitation_events_statement",
      sql`(${t.kind} = 'accepted') = (${t.statement} is not null)`,
    ),
    pgPolicy("medico_link_invitation_events_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("medico_link_invitation_events_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.actorUserId} = current_setting('app.current_actor', true) and exists (select 1 from public.medico_link_invitations i
        where i.id = ${t.invitationId} and i.org_id = ${t.orgId} and ${invitationOpen(sql.raw("i"))}
          and (
            (${t.kind} in ('accepted','declined') and i.user_id = ${t.actorUserId})
            or (${t.kind} = 'cancelled' and ${actorIsOwner})
            or (${t.kind} = 'approved' and ${actorIsOwner} and i.invited_by = i.user_id and i.user_id <> ${t.actorUserId}
              and exists (select 1 from public.medico_link_invitation_events a where a.org_id = i.org_id and a.invitation_id = i.id and a.kind = 'accepted'))
          ))`,
    }),
  ],
).enableRLS();

export type MedicoLinkInvitationEvent = InferSelectModel<
  typeof medicoLinkInvitationEvents
>;

/**
 * Vínculo profissional ↔ conta de acesso (NOB-149). Dá ao profissional cadastrado uma identidade
 * autenticada: só a conta vinculada ao médico com designação aberta de coordenador age como
 * coordenador daquela empresa. Histórico preservado: no máximo um vínculo ABERTO por profissional
 * e um por conta no escritório; revogar só encerra (sem DELETE). Só o owner vincula e revoga
 * (RLS com o ator da sessão, padrão 0056). Sem FK para `org_memberships`: a saída da conta do
 * escritório não pode apagar o histórico — a autorização exige a associação viva no uso.
 */
export const medicoUserLinks = pgTable(
  "medico_user_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    medicoId: uuid("medico_id").notNull(),
    userId: text("user_id").notNull(),
    reason: text("reason").notNull(),
    linkedBy: text("linked_by").notNull(),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: text("revoked_by"),
    revokeReason: text("revoke_reason"),
    // NOB-157: convite aceito que originou o vínculo. Nulo só nos vínculos anteriores ao convite.
    invitationId: uuid("invitation_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.medicoId, t.orgId],
      foreignColumns: [medicos.id, medicos.orgId],
    }).onDelete("restrict"),
    foreignKey({
      name: "fk_medico_user_links_invitation",
      columns: [t.invitationId, t.orgId],
      foreignColumns: [medicoLinkInvitations.id, medicoLinkInvitations.orgId],
    }).onDelete("restrict"),
    // Um convite gera no máximo um vínculo, mesmo depois de revogado.
    uniqueIndex("uq_medico_user_links_invitation").on(t.invitationId),
    // Alvo da FK composta da reconfirmação de vínculo legado (NOB-159).
    uniqueIndex("uq_medico_user_links_id_org").on(t.id, t.orgId),
    index("idx_medico_user_links_medico").on(t.orgId, t.medicoId),
    index("idx_medico_user_links_user").on(t.orgId, t.userId),
    uniqueIndex("uq_medico_user_links_open_medico")
      .on(t.orgId, t.medicoId)
      .where(sql`${t.revokedAt} is null`),
    uniqueIndex("uq_medico_user_links_open_user")
      .on(t.orgId, t.userId)
      .where(sql`${t.revokedAt} is null`),
    check(
      "ck_medico_user_links_revocation",
      sql`(${t.revokedAt} is null) = (${t.revokedBy} is null) and (${t.revokedAt} is null) = (${t.revokeReason} is null)`,
    ),
    pgPolicy("medico_user_links_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    // NOB-157: o vínculo só nasce de convite aceito pela própria conta convidada e, no
    // autovínculo, aprovado por outra conta owner. O owner não cria vínculo direto.
    pgPolicy("medico_user_links_invited_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.linkedBy} = current_setting('app.current_actor', true) and ${t.revokedAt} is null and exists (select 1 from public.medico_link_invitations i
        where i.id = ${t.invitationId} and i.org_id = ${t.orgId} and i.medico_id = ${t.medicoId} and i.user_id = ${t.userId}
          and ${invitationOpen(sql.raw("i"))}
          and exists (select 1 from public.medico_link_invitation_events a where a.org_id = i.org_id and a.invitation_id = i.id and a.kind = 'accepted' and a.actor_user_id = i.user_id)
          and (i.invited_by <> i.user_id or exists (select 1 from public.medico_link_invitation_events p where p.org_id = i.org_id and p.invitation_id = i.id and p.kind = 'approved' and p.actor_user_id <> i.user_id)
            or ${identityVerified(sql.raw("i.org_id"), sql.raw("i.medico_id"), sql.raw("i.user_id"))}))`,
    }),
    // Só um vínculo ABERTO pode ser alterado (revogado); revogado não reabre nem muda.
    pgPolicy("medico_user_links_owner_revoke", {
      as: "restrictive",
      for: "update",
      to: appRuntimeRole,
      using: sql`${t.revokedAt} is null and ${actorIsOwner}`,
      withCheck: sql`${t.revokedBy} = current_setting('app.current_actor', true)`,
    }),
  ],
).enableRLS();

export type MedicoUserLink = InferSelectModel<typeof medicoUserLinks>;
