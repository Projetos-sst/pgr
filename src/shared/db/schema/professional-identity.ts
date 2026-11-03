import { sql, type InferSelectModel } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { appRuntimeRole, identityVerifierRole } from "../roles";
import { medicos, medicoUserLinks } from "./medicos";
import { orgs } from "./orgs";

const tenantScope = sql`org_id = current_setting('app.current_org', true)`;
const actor = sql`current_setting('app.current_actor', true)`;

/** O ator é operador designado e ativo da plataforma (designação só por provisionamento no banco). */
const actorIsDesignatedVerifier = sql`exists (select 1 from public.identity_verifiers iv where iv.user_id = ${actor} and iv.revoked_at is null)`;

/**
 * Operadores da plataforma designados para conferir identidade profissional (NOB-158). Tabela
 * GLOBAL, sem caminho de escrita para a aplicação: a designação e a revogação são feitas só por
 * provisionamento no banco (procedimento documentado), nunca por owner, master ou pela própria
 * conta. O papel `identity_verifier` só lê.
 */
export const identityVerifiers = pgTable(
  "identity_verifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    designatedBy: text("designated_by").notNull(),
    designatedAt: timestamp("designated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: text("revoked_by"),
    revokeReason: text("revoke_reason"),
  },
  (t) => [
    uniqueIndex("uq_identity_verifiers_active")
      .on(t.userId)
      .where(sql`${t.revokedAt} is null`),
    check(
      "ck_identity_verifiers_revocation",
      sql`(${t.revokedAt} is null) = (${t.revokedBy} is null) and (${t.revokedAt} is null) = (${t.revokeReason} is null)`,
    ),
    check("ck_identity_verifiers_not_self", sql`${t.designatedBy} <> ${t.userId}`),
    pgPolicy("identity_verifiers_verifier_read", {
      for: "select",
      to: identityVerifierRole,
      using: sql`true`,
    }),
  ],
).enableRLS();

export type IdentityVerifier = InferSelectModel<typeof identityVerifiers>;

/**
 * Pedido de verificação feito pela PRÓPRIA conta do profissional, para o cadastro (médico) que ela
 * afirma ser, no escritório: exige vínculo ativo dessa conta com esse médico ou convite aceito em
 * aberto (autovínculo do único owner, NOB-160). Só inclusão.
 */
export const professionalIdentityRequests = pgTable(
  "professional_identity_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    medicoId: uuid("medico_id").notNull(),
    userId: text("user_id").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "fk_identity_requests_medico",
      columns: [t.medicoId, t.orgId],
      foreignColumns: [medicos.id, medicos.orgId],
    }).onDelete("restrict"),
    uniqueIndex("uq_identity_requests_id_org").on(t.id, t.orgId),
    index("idx_identity_requests_scope").on(t.orgId, t.medicoId, t.userId, t.requestedAt),
    pgPolicy("identity_requests_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("identity_requests_own_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.userId} = ${actor} and (
        exists (select 1 from public.medico_user_links l where l.org_id = ${t.orgId} and l.medico_id = ${t.medicoId} and l.user_id = ${actor} and l.revoked_at is null)
        or exists (select 1 from public.medico_link_invitations i where i.org_id = ${t.orgId} and i.medico_id = ${t.medicoId} and i.user_id = ${actor} and i.expires_at > now()
          and exists (select 1 from public.medico_link_invitation_events a where a.org_id = i.org_id and a.invitation_id = i.id and a.kind = 'accepted' and a.actor_user_id = i.user_id)
          and not exists (select 1 from public.medico_link_invitation_events c where c.org_id = i.org_id and c.invitation_id = i.id and c.kind in ('declined','cancelled'))))`,
    }),
    pgPolicy("identity_requests_verifier_read", {
      for: "select",
      to: identityVerifierRole,
      using: sql`true`,
    }),
  ],
).enableRLS();

export type ProfessionalIdentityRequest = InferSelectModel<
  typeof professionalIdentityRequests
>;

/** Checklist mínimo da conferência; todos os itens precisam estar confirmados (CHECK no banco). */
export type IdentityChecklist = {
  identityDocument: true;
  professionalDocument: true;
  registryStatus: true;
  personMatches: true;
  accountControl: true;
};

/**
 * Verificação de identidade profissional aprovada por operador designado (NOB-158). Liga pessoa
 * (documento conferido), registro (CRM/UF conferidos em fonte oficial), cadastro do médico e conta
 * autenticada (desafio de controle da conta). Sem documento bruto: só checklist, método, fonte do
 * registro e referência de auditoria. Gravada só pelo papel `identity_verifier`; o `app_runtime`
 * só lê o próprio tenant. Revogação em `professional_identity_review_events`.
 */
export const professionalIdentityVerifications = pgTable(
  "professional_identity_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").notNull(),
    medicoId: uuid("medico_id").notNull(),
    userId: text("user_id").notNull(),
    crm: text("crm").notNull(),
    registrationUf: text("registration_uf").notNull(),
    method: text("method").$type<"in_person" | "live_video">().notNull(),
    checklist: jsonb("checklist").$type<IdentityChecklist>().notNull(),
    registrySource: text("registry_source").notNull(),
    evidenceRef: text("evidence_ref"),
    verifiedBy: text("verified_by").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    foreignKey({
      name: "fk_identity_verifications_request",
      columns: [t.requestId, t.orgId],
      foreignColumns: [
        professionalIdentityRequests.id,
        professionalIdentityRequests.orgId,
      ],
    }).onDelete("restrict"),
    uniqueIndex("uq_identity_verifications_request").on(t.requestId),
    uniqueIndex("uq_identity_verifications_id_org").on(t.id, t.orgId),
    index("idx_identity_verifications_scope").on(
      t.orgId,
      t.medicoId,
      t.userId,
      t.verifiedAt,
    ),
    check(
      "ck_identity_verifications_method",
      sql`${t.method} in ('in_person','live_video')`,
    ),
    check("ck_identity_verifications_uf", sql`${t.registrationUf} ~ '^[A-Z]{2}$'`),
    check(
      "ck_identity_verifications_checklist",
      sql`${t.checklist} @> '{"identityDocument":true,"professionalDocument":true,"registryStatus":true,"personMatches":true,"accountControl":true}'::jsonb`,
    ),
    check(
      "ck_identity_verifications_validity",
      sql`${t.expiresAt} > ${t.verifiedAt} and ${t.expiresAt} <= ${t.verifiedAt} + interval '36 months'`,
    ),
    check("ck_identity_verifications_independent", sql`${t.verifiedBy} <> ${t.userId}`),
    check("ck_identity_verifications_source", sql`btrim(${t.registrySource}) <> ''`),
    pgPolicy("identity_verifications_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("identity_verifications_verifier_read", {
      for: "select",
      to: identityVerifierRole,
      using: sql`true`,
    }),
    // Operador designado, independente do escritório (não é membro dele) e da conta verificada;
    // pedido em aberto da própria conta; CRM/UF iguais ao cadastro do profissional.
    pgPolicy("identity_verifications_verifier_insert", {
      for: "insert",
      to: identityVerifierRole,
      withCheck: sql`${t.verifiedBy} = ${actor} and ${actorIsDesignatedVerifier}
        and ${t.verifiedBy} <> ${t.userId}
        and not exists (select 1 from public.org_memberships om where om.org_id = ${t.orgId} and om.user_id = ${actor})
        and exists (select 1 from public.professional_identity_requests rq where rq.id = ${t.requestId} and rq.org_id = ${t.orgId}
          and rq.medico_id = ${t.medicoId} and rq.user_id = ${t.userId}
          and not exists (select 1 from public.professional_identity_review_events r where r.org_id = rq.org_id and r.request_id = rq.id and r.kind = 'rejected'))
        and exists (select 1 from public.medicos m where m.id = ${t.medicoId} and m.org_id = ${t.orgId}
          and m.crm = ${t.crm} and m.registration_uf = ${t.registrationUf} and m.status = 'active' and m.profession = 'physician')`,
    }),
  ],
).enableRLS();

export type ProfessionalIdentityVerification = InferSelectModel<
  typeof professionalIdentityVerifications
>;

/**
 * Decisões do operador (só inclusão): recusa de pedido ou revogação de verificação, com motivo.
 * A revogação corta o acesso clínico na hora (a função central confere).
 */
export const professionalIdentityReviewEvents = pgTable(
  "professional_identity_review_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"rejected" | "revoked">().notNull(),
    requestId: uuid("request_id"),
    verificationId: uuid("verification_id"),
    reason: text("reason").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "fk_identity_reviews_request",
      columns: [t.requestId, t.orgId],
      foreignColumns: [
        professionalIdentityRequests.id,
        professionalIdentityRequests.orgId,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "fk_identity_reviews_verification",
      columns: [t.verificationId, t.orgId],
      foreignColumns: [
        professionalIdentityVerifications.id,
        professionalIdentityVerifications.orgId,
      ],
    }).onDelete("restrict"),
    uniqueIndex("uq_identity_reviews_rejected")
      .on(t.requestId)
      .where(sql`${t.kind} = 'rejected'`),
    uniqueIndex("uq_identity_reviews_revoked")
      .on(t.verificationId)
      .where(sql`${t.kind} = 'revoked'`),
    check(
      "ck_identity_reviews_kind",
      sql`(${t.kind} = 'rejected' and ${t.requestId} is not null and ${t.verificationId} is null) or (${t.kind} = 'revoked' and ${t.verificationId} is not null and ${t.requestId} is null)`,
    ),
    check("ck_identity_reviews_reason", sql`char_length(btrim(${t.reason})) >= 10`),
    pgPolicy("identity_reviews_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("identity_reviews_verifier_read", {
      for: "select",
      to: identityVerifierRole,
      using: sql`true`,
    }),
    pgPolicy("identity_reviews_verifier_insert", {
      for: "insert",
      to: identityVerifierRole,
      withCheck: sql`${t.actorUserId} = ${actor} and ${actorIsDesignatedVerifier}
        and not exists (select 1 from public.org_memberships om where om.org_id = ${t.orgId} and om.user_id = ${actor})`,
    }),
  ],
).enableRLS();

export type ProfessionalIdentityReviewEvent = InferSelectModel<
  typeof professionalIdentityReviewEvents
>;

/**
 * Reconfirmação de vínculo legado (NOB-159): vínculo anterior à 0069 (sem convite) só volta a dar
 * acesso clínico com a manifestação explícita da PRÓPRIA conta vinculada, além da verificação de
 * identidade. Só inclusão; uma por vínculo.
 */
export const medicoLinkReconfirmations = pgTable(
  "medico_link_reconfirmations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    linkId: uuid("link_id").notNull(),
    userId: text("user_id").notNull(),
    statement: text("statement").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "fk_link_reconfirmations_link",
      columns: [t.linkId, t.orgId],
      foreignColumns: [medicoUserLinks.id, medicoUserLinks.orgId],
    }).onDelete("restrict"),
    uniqueIndex("uq_link_reconfirmations_link").on(t.linkId),
    pgPolicy("link_reconfirmations_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
    pgPolicy("link_reconfirmations_own_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.userId} = ${actor} and exists (select 1 from public.medico_user_links l
        where l.id = ${t.linkId} and l.org_id = ${t.orgId} and l.user_id = ${actor} and l.revoked_at is null and l.invitation_id is null)`,
    }),
  ],
).enableRLS();

export type MedicoLinkReconfirmation = InferSelectModel<typeof medicoLinkReconfirmations>;
