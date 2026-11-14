import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  timestamp,
  unique,
  foreignKey,
  pgPolicy,
  index,
  check,
} from "drizzle-orm/pg-core";
import { appRuntimeRole } from "../roles";
import { companies } from "./companies";
import { orgMemberships } from "./org-memberships";
import { medicalRiskEntries } from "./medical-risk-sources";
import type { ProfessionalIdentity } from "@/shared/domains/medicine/risk-authorization";
import { actorCompanyScope } from "./access-scope-policy";

const tenant = sql`org_id = current_setting('app.current_org', true)`;
const owner = sql`exists (select 1 from public.org_memberships m where m.org_id = current_setting('app.current_org', true) and m.user_id = current_setting('app.current_actor', true) and m.role in ('owner','org:admin'))`;
const actor = sql`current_setting('app.current_actor', true)`;

export function companyRepresentativeBinding(
  orgId: SQLWrapper,
  companyId: SQLWrapper,
  userId: SQLWrapper,
): SQL<boolean> {
  return sql<boolean>`exists (select 1 from public.org_memberships m where m.org_id = ${orgId} and m.user_id = ${userId} and m.role in ('client','org:client') and (m.scoped_company_id = ${companyId} or (m.scoped_company_id is null and exists (select 1 from public.member_access_scopes s where s.org_id = m.org_id and s.user_id = m.user_id and s.company_id = ${companyId}))))`;
}
const scopeColumns = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: text("org_id").notNull(),
  companyId: uuid("company_id").notNull(),
});

type AuthorizerColumns = { orgId: SQLWrapper; companyId: SQLWrapper; userId: SQLWrapper };
function appointer(t: AuthorizerColumns): SQL<boolean> {
  return sql<boolean>`(${owner} or (${t.userId} is distinct from ${actor} and ${companyRepresentativeBinding(t.orgId, t.companyId, actor)} and not exists (select 1 from public.professional_risk_authorizations p where p.org_id = ${t.orgId} and p.company_id = ${t.companyId} and p.user_id = ${actor} and p.active = true)))`;
}

export const companyRiskAuthorizers = pgTable(
  "company_risk_authorizers",
  {
    ...scopeColumns(),
    userId: text("user_id"),
    evidence: text("evidence").notNull(),
    reason: text("reason").notNull(),
    recordedBy: text("recorded_by").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    pgPolicy("company_risk_authorizers_actor_scope", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: actorCompanyScope(t.companyId),
    }),
    unique("uq_company_risk_authorizer").on(t.orgId, t.companyId),
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.orgId, t.userId],
      foreignColumns: [orgMemberships.orgId, orgMemberships.userId],
    }).onDelete("cascade"),
    pgPolicy("risk_authorizers_tenant", {
      for: "all",
      to: appRuntimeRole,
      using: tenant,
      withCheck: tenant,
    }),
    pgPolicy("risk_authorizers_owner_insert", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${appointer(t)} and ${t.recordedBy} = ${actor}`,
    }),
    pgPolicy("risk_authorizers_owner_update", {
      as: "restrictive",
      for: "update",
      to: appRuntimeRole,
      using: appointer(t),
      withCheck: sql`${appointer(t)} and ${t.recordedBy} = ${actor}`,
    }),
  ],
).enableRLS();

export const professionalRiskAuthorizations = pgTable(
  "professional_risk_authorizations",
  {
    ...scopeColumns(),
    userId: text("user_id").notNull(),
    active: boolean("active").notNull(),
    identity: jsonb("identity").$type<ProfessionalIdentity>().notNull(),
    authorizedBy: text("authorized_by").notNull(),
    authorizedAt: timestamp("authorized_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reason: text("reason").notNull(),
  },
  (t) => {
    const authorizer = sql`exists (select 1 from public.company_risk_authorizers a where a.org_id = ${t.orgId} and a.company_id = ${t.companyId} and a.user_id = current_setting('app.current_actor', true))`;
    return [
      unique("uq_professional_risk_authorization").on(t.orgId, t.companyId, t.userId),
      foreignKey({
        columns: [t.companyId, t.orgId],
        foreignColumns: [companies.id, companies.orgId],
      }).onDelete("cascade"),
      foreignKey({
        columns: [t.orgId, t.userId],
        foreignColumns: [orgMemberships.orgId, orgMemberships.userId],
      }).onDelete("cascade"),
      check(
        "professional_risk_identity_object",
        sql`jsonb_typeof(${t.identity}) = 'object'`,
      ),
      pgPolicy("professional_risk_authorizations_actor_scope", {
        as: "restrictive",
        for: "all",
        to: appRuntimeRole,
        using: actorCompanyScope(t.companyId),
      }),
      pgPolicy("professional_risk_authorizations_tenant", {
        for: "all",
        to: appRuntimeRole,
        using: tenant,
        withCheck: tenant,
      }),
      pgPolicy("professional_risk_authorizations_grant", {
        as: "restrictive",
        for: "insert",
        to: appRuntimeRole,
        withCheck: sql`${authorizer} and ${t.authorizedBy} = current_setting('app.current_actor', true)`,
      }),
      pgPolicy("professional_risk_authorizations_change", {
        as: "restrictive",
        for: "update",
        to: appRuntimeRole,
        using: authorizer,
        withCheck: sql`${authorizer} and ${t.authorizedBy} = current_setting('app.current_actor', true)`,
      }),
    ];
  },
).enableRLS();

export const riskAuthorizationEvents = pgTable(
  "risk_authorization_events",
  {
    ...scopeColumns(),
    actor: text("actor").notNull(),
    subjectUserId: text("subject_user_id"),
    event: text("event").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    pgPolicy("risk_authorization_events_actor_scope", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: actorCompanyScope(t.companyId),
    }),
    foreignKey({
      columns: [t.companyId, t.orgId],
      foreignColumns: [companies.id, companies.orgId],
    }).onDelete("cascade"),
    index("idx_risk_authorization_events_company").on(t.orgId, t.companyId, t.createdAt),
    pgPolicy("risk_authorization_events_tenant", {
      for: "all",
      to: appRuntimeRole,
      using: tenant,
      withCheck: tenant,
    }),
    pgPolicy("risk_authorization_events_actor", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.actor} = current_setting('app.current_actor', true)`,
    }),
  ],
).enableRLS();

export const medicalRiskDecisions = pgTable(
  "medical_risk_decisions",
  {
    ...scopeColumns(),
    entryId: uuid("entry_id").notNull(),
    reviewerId: text("reviewer_id").notNull(),
    identity: jsonb("identity").$type<ProfessionalIdentity>().notNull(),
    previousStatus: text("previous_status").notNull(),
    status: text("status").notNull(),
    reason: text("reason").notNull(),
    sourceFingerprint: text("source_fingerprint").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    pgPolicy("medical_risk_decisions_actor_scope", {
      as: "restrictive",
      for: "all",
      to: appRuntimeRole,
      using: actorCompanyScope(t.companyId),
    }),
    foreignKey({
      columns: [t.entryId, t.orgId, t.companyId],
      foreignColumns: [
        medicalRiskEntries.id,
        medicalRiskEntries.orgId,
        medicalRiskEntries.companyId,
      ],
    }).onDelete("cascade"),
    check("medical_risk_decision_status", sql`${t.status} in ('validated','rejected')`),
    index("idx_medical_risk_decisions_company").on(t.orgId, t.companyId, t.reviewedAt),
    pgPolicy("medical_risk_decisions_tenant", {
      for: "all",
      to: appRuntimeRole,
      using: tenant,
      withCheck: tenant,
    }),
    pgPolicy("medical_risk_decisions_professional", {
      as: "restrictive",
      for: "insert",
      to: appRuntimeRole,
      withCheck: sql`${t.reviewerId} = current_setting('app.current_actor', true) and exists (select 1 from public.professional_risk_authorizations a where a.org_id = ${t.orgId} and a.company_id = ${t.companyId} and a.user_id = current_setting('app.current_actor', true) and a.active = true)`,
    }),
  ],
).enableRLS();
