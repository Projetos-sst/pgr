import "server-only";
import { and, eq, desc, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { toDomainRole } from "@/shared/tenant/roles";
import type {
  AppointmentOrigin,
  CompanyAuthorizerInput,
  ProfessionalAuthorizationInput,
  MedicalRiskDecisionInput,
} from "@/shared/domains/medicine/risk-authorization";
import { withOrg, type TenantTransaction } from "../with-org";
import { companies } from "../schema/companies";
import { orgMemberships } from "../schema/org-memberships";
import {
  companyRepresentativeBinding,
  companyRiskAuthorizers as authorizers,
  professionalRiskAuthorizations as grants,
  riskAuthorizationEvents as events,
  medicalRiskDecisions as decisions,
} from "../schema/medical-risk-authorizations";
import {
  medicalRiskEntries as entries,
  medicalRiskSources as sources,
} from "../schema/medical-risk-sources";
import { assertCompanyModuleTx } from "./company-modules";
import { auditedTenantWrite } from "./audited-write";
import {
  getInternalMedicalSources,
  lockMedicalRiskBasisTx,
} from "./medical-risk-sources";
import { medicalSourceFingerprint } from "@/shared/domains/medicine/source-fingerprint";
import { resolvePageParams, type PageParams } from "@/shared/pagination";

function scoped(ctx: TenantContext, companyId: string) {
  return and(eq(authorizers.orgId, ctx.tenantId), eq(authorizers.companyId, companyId));
}
async function actorTx<T>(ctx: TenantContext, fn: (tx: TenantTransaction) => Promise<T>) {
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor', ${ctx.userId}, true)`);
    return fn(tx);
  });
}
async function membership(
  tx: TenantTransaction,
  orgId: string,
  userId: string,
  companyId: string,
) {
  const [row] = await tx
    .select()
    .from(orgMemberships)
    .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.userId, userId)))
    .limit(1);
  if (!row || (row.scopedCompanyId && row.scopedCompanyId !== companyId))
    throw new ForbiddenError("A conta não possui vínculo permitido com esta empresa.");
  return row;
}
function appointmentOrigin(
  ctx: TenantContext,
  memberRole: string,
  representative: boolean,
  delegated: boolean,
): AppointmentOrigin | null {
  if (ctx.role === "owner" && toDomainRole(memberRole) === "owner") return "office_owner";
  if (ctx.role === "client" && representative && !delegated)
    return "company_representative";
  return null;
}
async function context(
  tx: TenantTransaction,
  ctx: TenantContext,
  companyId: string,
  lock = false,
) {
  const query = tx
    .select({
      id: companies.id,
      name: companies.razaoSocial,
      representative: companyRepresentativeBinding(
        sql`${ctx.tenantId}`,
        sql`${companyId}::uuid`,
        sql`${ctx.userId}`,
      ),
    })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.orgId, ctx.tenantId)))
    .limit(1);
  const [found] = await (lock ? query.for("update") : query);
  if (!found) throw new NotFoundError();
  const { representative, ...company } = found;
  const member = await membership(tx, ctx.tenantId, ctx.userId, companyId);
  const [authorizer] = await tx
    .select()
    .from(authorizers)
    .where(scoped(ctx, companyId))
    .limit(1);
  const [grant] = await tx
    .select()
    .from(grants)
    .where(
      and(
        eq(grants.orgId, ctx.tenantId),
        eq(grants.companyId, companyId),
        eq(grants.userId, ctx.userId),
      ),
    )
    .limit(1);
  const canAuthorize = authorizer?.userId === ctx.userId;
  const canReview = grant?.active === true;
  const origin = appointmentOrigin(
    ctx,
    member.role,
    representative,
    canAuthorize || canReview,
  );
  return {
    company,
    authorizer: authorizer ?? null,
    grant: grant ?? null,
    appointmentOrigin: origin,
    canAppoint: origin !== null,
    canAuthorize,
    canReview,
  };
}
function requireWorkspace(access: {
  canAppoint: boolean;
  canAuthorize: boolean;
  canReview: boolean;
}) {
  if (!access.canAppoint && !access.canAuthorize && !access.canReview)
    throw new ForbiddenError("Sem indicação ou autorização para esta empresa.");
}

export async function setCompanyRiskAuthorizer(
  ctx: TenantContext,
  companyId: string,
  input: CompanyAuthorizerInput,
) {
  return auditedTenantWrite(ctx.tenantId, "medicine.authorizer.change", () =>
    actorTx(ctx, async (tx) => {
      const access = await context(tx, ctx, companyId, true);
      if (!access.appointmentOrigin)
        throw new ForbiddenError(
          "Somente o administrador do escritório ou o representante da própria empresa pode registrar a indicação.",
        );
      if (
        access.appointmentOrigin === "company_representative" &&
        input.userId === ctx.userId
      )
        throw new ForbiddenError(
          "O representante da empresa não pode indicar a própria conta como autorizador.",
        );
      if (input.userId) await membership(tx, ctx.tenantId, input.userId, companyId);
      await tx
        .insert(authorizers)
        .values({
          orgId: ctx.tenantId,
          companyId,
          userId: input.userId,
          evidence: input.evidence,
          reason: input.reason,
          recordedBy: ctx.userId,
        })
        .onConflictDoUpdate({
          target: [authorizers.orgId, authorizers.companyId],
          set: {
            userId: input.userId,
            evidence: input.evidence,
            reason: input.reason,
            recordedBy: ctx.userId,
            recordedAt: new Date(),
          },
        });
      await tx.insert(events).values({
        orgId: ctx.tenantId,
        companyId,
        actor: ctx.userId,
        subjectUserId: input.userId,
        event: input.userId ? "authorizer_appointed" : "authorizer_revoked",
        details: {
          previous: access.authorizer,
          next: input,
          origin: access.appointmentOrigin,
        },
      });
    }),
  );
}

export async function setProfessionalRiskAuthorization(
  ctx: TenantContext,
  companyId: string,
  input: ProfessionalAuthorizationInput,
) {
  return auditedTenantWrite(ctx.tenantId, "medicine.professional.change", () =>
    actorTx(ctx, async (tx) => {
      const access = await context(tx, ctx, companyId, true);
      if (!access.canAuthorize)
        throw new ForbiddenError(
          "Somente o autorizador indicado por esta empresa pode autorizar profissionais.",
        );
      if (input.active) await membership(tx, ctx.tenantId, input.userId, companyId);
      const where = and(
        eq(grants.orgId, ctx.tenantId),
        eq(grants.companyId, companyId),
        eq(grants.userId, input.userId),
      );
      const [previous] = await tx.select().from(grants).where(where).limit(1);
      if (!input.active && !previous) throw new NotFoundError();
      const now = new Date();
      if (input.active)
        await tx
          .insert(grants)
          .values({
            orgId: ctx.tenantId,
            companyId,
            userId: input.userId,
            active: true,
            identity: input.identity,
            authorizedBy: ctx.userId,
            authorizedAt: now,
            reason: input.reason,
          })
          .onConflictDoUpdate({
            target: [grants.orgId, grants.companyId, grants.userId],
            set: {
              active: true,
              identity: input.identity,
              authorizedBy: ctx.userId,
              authorizedAt: now,
              reason: input.reason,
            },
          });
      else
        await tx
          .update(grants)
          .set({
            active: false,
            authorizedBy: ctx.userId,
            authorizedAt: now,
            reason: input.reason,
          })
          .where(where);
      await tx.insert(events).values({
        orgId: ctx.tenantId,
        companyId,
        actor: ctx.userId,
        subjectUserId: input.userId,
        event: input.active ? "professional_authorized" : "professional_revoked",
        details: { previous: previous ?? null, next: input },
      });
    }),
  );
}

export async function reviewMedicalRisk(
  ctx: TenantContext,
  companyId: string,
  entryId: string,
  input: MedicalRiskDecisionInput,
) {
  return auditedTenantWrite(ctx.tenantId, "medicine.risk.review", () =>
    actorTx(ctx, async (tx) => {
      const access = await context(tx, ctx, companyId, true);
      if (!access.canReview || !access.grant)
        throw new ForbiddenError(
          "Validação exige autorização profissional ativa nesta empresa.",
        );
      await assertCompanyModuleTx(tx, ctx.tenantId, companyId, "medicine");
      await lockMedicalRiskBasisTx(tx, ctx.tenantId, companyId);
      const [entry] = await tx
        .select()
        .from(entries)
        .where(
          and(
            eq(entries.orgId, ctx.tenantId),
            eq(entries.companyId, companyId),
            eq(entries.id, entryId),
          ),
        )
        .for("update")
        .limit(1);
      if (!entry) throw new NotFoundError();
      const prior = entry.reviewedAt?.getTime() ?? null;
      if (
        entry.status !== input.expectedStatus ||
        prior !== (input.expectedReviewedAt ? Date.parse(input.expectedReviewedAt) : null)
      )
        throw new ValidationError(
          "O risco foi revisado por outra operação. Atualize a página antes de decidir.",
        );
      const [source] = await tx
        .select()
        .from(sources)
        .where(
          and(
            eq(sources.id, entry.sourceId),
            eq(sources.orgId, ctx.tenantId),
            eq(sources.companyId, companyId),
          ),
        )
        .limit(1);
      if (!source) throw new NotFoundError();
      const [successor] = await tx
        .select({ id: sources.id })
        .from(sources)
        .where(
          and(
            eq(sources.orgId, ctx.tenantId),
            eq(sources.companyId, companyId),
            eq(sources.supersedesSourceId, source.id),
          ),
        )
        .limit(1);
      if (input.status === "validated") {
        if (successor)
          throw new ValidationError("Esta fonte foi substituída. Revise a versão atual.");
        if (source.originPgrId) {
          const [current] = await getInternalMedicalSources(
            ctx.tenantId,
            companyId,
            [source.originPgrId],
            tx,
          );
          if (!current || medicalSourceFingerprint(current) !== source.fingerprint)
            throw new ValidationError(
              "O PGR de origem mudou ou está indisponível. Registre e revise uma nova fonte.",
            );
        }
      }
      const now = new Date();
      await tx
        .update(entries)
        .set({
          status: input.status,
          reviewedBy: ctx.userId,
          reviewedAt: now,
          reviewNote: input.reason,
        })
        .where(eq(entries.id, entry.id));
      const [decision] = await tx
        .insert(decisions)
        .values({
          orgId: ctx.tenantId,
          companyId,
          entryId,
          reviewerId: ctx.userId,
          identity: access.grant.identity,
          previousStatus: entry.status,
          status: input.status,
          reason: input.reason,
          sourceFingerprint: source.fingerprint,
          reviewedAt: now,
        })
        .returning();
      return decision;
    }),
  );
}

export async function getRiskAuthorizationWorkspace(
  ctx: TenantContext,
  companyId: string,
  page: PageParams = {},
) {
  return actorTx(ctx, async (tx) => {
    const access = await context(tx, ctx, companyId);
    requireWorkspace(access);
    const managing = access.canAppoint || access.canAuthorize;
    const grantScope = and(
      eq(grants.orgId, ctx.tenantId),
      eq(grants.companyId, companyId),
      managing ? undefined : eq(grants.userId, ctx.userId),
    );
    const professionals = await tx
      .select()
      .from(grants)
      .where(grantScope)
      .orderBy(desc(grants.authorizedAt));
    const { limit, offset } = resolvePageParams(page);
    const eventScope = and(
      eq(events.orgId, ctx.tenantId),
      eq(events.companyId, companyId),
      managing ? undefined : eq(events.subjectUserId, ctx.userId),
    );
    const history = await tx
      .select()
      .from(events)
      .where(eventScope)
      .orderBy(desc(events.createdAt), desc(events.id))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(events)
      .where(eventScope);
    const reviewScope = and(
      eq(decisions.orgId, ctx.tenantId),
      eq(decisions.companyId, companyId),
      managing ? undefined : eq(decisions.reviewerId, ctx.userId),
    );
    const reviewHistory = await tx
      .select()
      .from(decisions)
      .where(reviewScope)
      .orderBy(desc(decisions.reviewedAt), desc(decisions.id))
      .limit(limit)
      .offset(offset);
    const [{ reviewTotal }] = await tx
      .select({ reviewTotal: sql<number>`count(*)::int` })
      .from(decisions)
      .where(reviewScope);
    return {
      company: access.company,
      appointmentOrigin: access.appointmentOrigin,
      canAppoint: access.canAppoint,
      canAuthorize: access.canAuthorize,
      canReview: access.canReview,
      authorizer: managing ? access.authorizer : null,
      professionals,
      history: { rows: history, total },
      reviews: { rows: reviewHistory, total: reviewTotal },
    };
  });
}

export async function listRiskAuthorizationCompanies(
  ctx: TenantContext,
  page: PageParams = {},
) {
  return actorTx(ctx, async (tx) => {
    const { limit, offset } = resolvePageParams(page);
    const actor = await tx
      .select()
      .from(orgMemberships)
      .where(
        and(
          eq(orgMemberships.orgId, ctx.tenantId),
          eq(orgMemberships.userId, ctx.userId),
        ),
      )
      .limit(1);
    if (!actor[0]) throw new ForbiddenError();
    const owner = ctx.role === "owner" && toDomainRole(actor[0].role) === "owner";
    const representative = companyRepresentativeBinding(
      companies.orgId,
      companies.id,
      sql`${ctx.userId}`,
    );
    const eligibility = sql`(${owner} or ${representative} or exists (select 1 from public.company_risk_authorizers a where a.org_id=${companies.orgId} and a.company_id=${companies.id} and a.user_id=${ctx.userId}) or exists (select 1 from public.professional_risk_authorizations p where p.org_id=${companies.orgId} and p.company_id=${companies.id} and p.user_id=${ctx.userId} and p.active=true))`;
    const where = and(
      eq(companies.orgId, ctx.tenantId),
      eligibility,
      actor[0].scopedCompanyId ? eq(companies.id, actor[0].scopedCompanyId) : undefined,
    );
    const rows = await tx
      .select({ id: companies.id, name: companies.razaoSocial })
      .from(companies)
      .where(where)
      .orderBy(companies.razaoSocial, companies.id)
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(companies)
      .where(where);
    return { rows, total };
  });
}

export async function canReviewCompanyRisks(
  ctx: TenantContext,
  companyId: string,
): Promise<boolean> {
  return actorTx(ctx, async (tx) => {
    const [row] = await tx
      .select({ id: grants.id })
      .from(grants)
      .innerJoin(
        orgMemberships,
        and(
          eq(orgMemberships.orgId, grants.orgId),
          eq(orgMemberships.userId, grants.userId),
        ),
      )
      .where(
        and(
          eq(grants.orgId, ctx.tenantId),
          eq(grants.companyId, companyId),
          eq(grants.userId, ctx.userId),
          eq(grants.active, true),
          sql`(${orgMemberships.scopedCompanyId} is null or ${orgMemberships.scopedCompanyId}=${companyId})`,
        ),
      )
      .limit(1);
    return !!row;
  });
}
