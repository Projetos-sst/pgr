import "server-only";
import { and, eq, desc, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import type {
  DocumentReviewerInput,
  DocumentApprovalInput,
} from "@/shared/domains/pgr/document-approval";
import { withOrg, type TenantTransaction } from "../with-org";
import { pgrDocumentApprovals as approvals } from "../schema/pgr-document-approvals";
import { pgrReviewSamples } from "../schema/pgr-document-reviews";
import { pgr } from "../schema/pgr";
import { orgMemberships } from "../schema/org-memberships";

function scope(orgId: string, pgrId: string) {
  return and(eq(approvals.orgId, orgId), eq(approvals.pgrId, pgrId));
}
export async function getDocumentApprovalTx(
  tx: TenantTransaction,
  orgId: string,
  pgrId: string,
) {
  const [assignment] = await tx
    .select()
    .from(approvals)
    .where(and(scope(orgId, pgrId), eq(approvals.kind, "assignment")))
    .orderBy(desc(approvals.createdAt), desc(approvals.id))
    .limit(1);
  const [decision] = assignment
    ? await tx
        .select()
        .from(approvals)
        .where(and(scope(orgId, pgrId), eq(approvals.assignmentId, assignment.id)))
        .orderBy(desc(approvals.createdAt), desc(approvals.id))
        .limit(1)
    : [];
  return { assignment: assignment ?? null, decision: decision ?? null };
}
export async function getDocumentApproval(orgId: string, pgrId: string) {
  return withOrg(orgId, (tx) => getDocumentApprovalTx(tx, orgId, pgrId));
}
async function membership(
  tx: TenantTransaction,
  ctx: TenantContext,
  userId: string,
  reviewerCompany?: string,
) {
  const [member] = await tx
    .select()
    .from(orgMemberships)
    .where(and(eq(orgMemberships.orgId, ctx.tenantId), eq(orgMemberships.userId, userId)))
    .limit(1);
  if (
    reviewerCompany &&
    member &&
    ["client", "org:client"].includes(member.role) &&
    member.scopedCompanyId === reviewerCompany
  )
    return;
  if (
    !member ||
    !["owner", "org:admin", "collaborator", "org:member"].includes(member.role) ||
    member.scopedCompanyId
  )
    throw new ForbiddenError("Selecione uma conta ativa da equipe deste escritório.");
}
export async function assignDocumentReviewer(
  ctx: TenantContext,
  pgrId: string,
  input: DocumentReviewerInput,
) {
  if (ctx.role !== "owner")
    throw new ForbiddenError("Somente o administrador designa o revisor.");
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor',${ctx.userId},true)`);
    const [head] = await tx
      .select()
      .from(pgr)
      .where(and(eq(pgr.orgId, ctx.tenantId), eq(pgr.id, pgrId)))
      .for("update")
      .limit(1);
    if (!head) throw new NotFoundError();
    await membership(tx, ctx, ctx.userId);
    await membership(tx, ctx, input.reviewerUserId, head.companyId);
    await membership(tx, ctx, input.authorUserId);
    if (head.createdBy && head.createdBy !== input.authorUserId)
      throw new ValidationError(
        "O elaborador deve corresponder à conta que criou o PGR.",
      );
    const { assignment } = await getDocumentApprovalTx(tx, ctx.tenantId, pgrId);
    if ((assignment?.id ?? null) !== input.expectedAssignmentId)
      throw new ValidationError("A designação mudou. Atualize a página.");
    const [row] = await tx
      .insert(approvals)
      .values({
        orgId: ctx.tenantId,
        pgrId,
        kind: "assignment",
        authorUserId: input.authorUserId,
        reviewerUserId: input.reviewerUserId,
        reviewer: input.reviewer,
        status: "pending",
        actor: ctx.userId,
        reason: input.reason,
      })
      .returning();
    return row;
  });
}
export async function decideDocumentApproval(
  ctx: TenantContext,
  pgrId: string,
  input: DocumentApprovalInput,
  sourceSha256: string,
  templateSha256: string,
) {
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor',${ctx.userId},true)`);
    const [head] = await tx
      .select({ id: pgr.id, companyId: pgr.companyId })
      .from(pgr)
      .where(and(eq(pgr.orgId, ctx.tenantId), eq(pgr.id, pgrId)))
      .for("update")
      .limit(1);
    if (!head) throw new NotFoundError();
    const { assignment, decision } = await getDocumentApprovalTx(tx, ctx.tenantId, pgrId);
    if (
      !assignment ||
      assignment.id !== input.assignmentId ||
      (decision?.id ?? null) !== input.expectedDecisionId
    )
      throw new ValidationError("A revisão mudou. Atualize a página.");
    if (
      assignment.reviewerUserId !== ctx.userId ||
      assignment.authorUserId === ctx.userId
    )
      throw new ForbiddenError(
        "Somente o revisor designado pode registrar o próprio parecer, sem autoaprovação.",
      );
    await membership(tx, ctx, ctx.userId, head.companyId);
    const [sample] = await tx
      .select()
      .from(pgrReviewSamples)
      .where(
        and(
          eq(pgrReviewSamples.orgId, ctx.tenantId),
          eq(pgrReviewSamples.pgrId, pgrId),
          eq(pgrReviewSamples.id, input.sampleId),
        ),
      )
      .limit(1);
    if (!sample) throw new NotFoundError();
    if (sample.createdBy === ctx.userId)
      throw new ForbiddenError(
        "O revisor não pode aprovar uma amostra que ele próprio preparou.",
      );
    if (
      sample.snapshotSha256 !== sourceSha256 ||
      sample.templateSha256 !== templateSha256
    )
      throw new ValidationError(
        "Os dados ou o modelo mudaram. Prepare uma nova amostra para revisão.",
      );
    const [row] = await tx
      .insert(approvals)
      .values({
        orgId: ctx.tenantId,
        pgrId,
        kind: "decision",
        assignmentId: assignment.id,
        sampleId: sample.id,
        authorUserId: assignment.authorUserId,
        reviewerUserId: assignment.reviewerUserId,
        reviewer: assignment.reviewer,
        status: input.status,
        sourceSha256,
        templateSha256,
        actor: ctx.userId,
        reason: input.reason,
      })
      .returning();
    return row;
  });
}

/** Restricted client memberships gain no office-staff capability. */
export async function assertDocumentReviewAccess(ctx: TenantContext, pgrId: string) {
  if (["owner", "collaborator"].includes(ctx.role)) return;
  if (ctx.role !== "client") throw new ForbiddenError();
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor',${ctx.userId},true)`);
    const [head] = await tx
      .select({ companyId: pgr.companyId })
      .from(pgr)
      .where(and(eq(pgr.orgId, ctx.tenantId), eq(pgr.id, pgrId)))
      .limit(1);
    if (!head) throw new NotFoundError();
    await membership(tx, ctx, ctx.userId, head.companyId);
    const { assignment } = await getDocumentApprovalTx(tx, ctx.tenantId, pgrId);
    if (assignment?.reviewerUserId !== ctx.userId)
      throw new ForbiddenError("Este PGR não foi designado para sua revisão.");
  });
}
export async function addRestrictedDocumentReviewer(
  ctx: TenantContext,
  pgrId: string,
  userId: string,
) {
  if (ctx.role !== "owner") throw new ForbiddenError();
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor',${ctx.userId},true)`);
    await tx.execute(
      sql`select public.add_restricted_pgr_reviewer(${ctx.tenantId},${pgrId}::uuid,${userId})`,
    );
    return {
      userId,
      reviewPath: `/pgr/${pgrId}/reviews?reviewOrg=${encodeURIComponent(ctx.tenantId)}`,
    };
  });
}
export async function revokeRestrictedDocumentReviewer(
  ctx: TenantContext,
  pgrId: string,
  userId: string,
) {
  if (ctx.role !== "owner") throw new ForbiddenError();
  return withOrg(ctx.tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor',${ctx.userId},true)`);
    await tx.execute(
      sql`select public.revoke_restricted_pgr_reviewer(${ctx.tenantId},${pgrId}::uuid,${userId})`,
    );
  });
}
