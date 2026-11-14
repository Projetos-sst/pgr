import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import type { ApprovalEvent } from "@/shared/domains/pgr/document-approval";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { toDomainRole } from "@/shared/tenant/roles";
import { withOrg, type TenantTransaction } from "../with-org";
import { documents } from "../schema/documents";
import { orgMemberships } from "../schema/org-memberships";
import { pgr } from "../schema/pgr";
import { pgrDocumentApprovals as approvals } from "../schema/pgr-document-approvals";
import { auditedTenantWrite } from "./audited-write";

const WRITE_REJECTED = "pgr.document_approval.write_rejected";
const eventColumns = {
  id: approvals.id,
  seq: approvals.seq,
  kind: approvals.kind,
  assignmentId: approvals.assignmentId,
  decisionId: approvals.decisionId,
  supersedesIssueId: approvals.supersedesIssueId,
  cancelledIssueId: approvals.cancelledIssueId,
  authorUserId: approvals.authorUserId,
  reviewerUserId: approvals.reviewerUserId,
  reviewerIdentity: approvals.reviewerIdentity,
  snapshotSha256: approvals.snapshotSha256,
  templateSha256: approvals.templateSha256,
  fileSha256: approvals.fileSha256,
  documentId: approvals.documentId,
  actor: approvals.actor,
  reason: approvals.reason,
  createdAt: approvals.createdAt,
};

type PgrHead = { id: string; createdBy: string | null };
export type NewApprovalEvent = Omit<
  typeof approvals.$inferInsert,
  "id" | "orgId" | "pgrId" | "actor" | "createdAt"
>;
type FinalIssueDocument = {
  name: string;
  documentGroupId: string;
  storagePath: string;
  sizeBytes: number;
};
export type ApprovalWriteScope = {
  tx: TenantTransaction;
  head: PgrHead;
  events: ApprovalEvent[];
};

function ofPgr(orgId: string, pgrId: string) {
  return and(eq(approvals.orgId, orgId), eq(approvals.pgrId, pgrId));
}

function setActor(tx: TenantTransaction, userId: string) {
  return tx.execute(sql`select set_config('app.current_actor', ${userId}, true)`);
}

function selectEvents(tx: TenantTransaction, orgId: string, pgrId: string) {
  return tx
    .select(eventColumns)
    .from(approvals)
    .where(ofPgr(orgId, pgrId))
    .orderBy(asc(approvals.seq));
}

async function findPgr(
  tx: TenantTransaction,
  orgId: string,
  pgrId: string,
  lock = false,
): Promise<PgrHead | null> {
  const query = tx
    .select({ id: pgr.id, createdBy: pgr.createdBy })
    .from(pgr)
    .where(and(eq(pgr.orgId, orgId), eq(pgr.id, pgrId)))
    .limit(1);
  const [head] = await (lock ? query.for("update") : query);
  return head ?? null;
}

export async function listApprovalEvents(
  orgId: string,
  pgrId: string,
): Promise<ApprovalEvent[]> {
  return withOrg(orgId, (tx) => selectEvents(tx, orgId, pgrId));
}

export async function getApprovalContext(ctx: TenantContext, pgrId: string) {
  return withOrg(ctx.tenantId, async (tx) => {
    await setActor(tx, ctx.userId);
    const head = await findPgr(tx, ctx.tenantId, pgrId);
    if (!head) throw new NotFoundError();
    return { head, events: await selectEvents(tx, ctx.tenantId, pgrId) };
  });
}

export async function canReviewPgr(
  tx: TenantTransaction,
  ctx: TenantContext,
  pgrId: string,
  userId: string,
): Promise<boolean> {
  const [membership] = await tx
    .select({
      role: orgMemberships.role,
      scopedCompanyId: orgMemberships.scopedCompanyId,
    })
    .from(orgMemberships)
    .where(and(eq(orgMemberships.orgId, ctx.tenantId), eq(orgMemberships.userId, userId)))
    .limit(1);
  if (!membership || membership.scopedCompanyId) return false;
  if (toDomainRole(membership.role) === "client") return false;
  await setActor(tx, userId);
  const visible = await findPgr(tx, ctx.tenantId, pgrId);
  await setActor(tx, ctx.userId);
  return visible !== null;
}

export async function appendApprovalEvent(
  ctx: TenantContext,
  pgrId: string,
  build: (scope: ApprovalWriteScope) => Promise<NewApprovalEvent>,
): Promise<ApprovalEvent> {
  return auditedTenantWrite(ctx.tenantId, WRITE_REJECTED, () =>
    withOrg(ctx.tenantId, async (tx) => {
      await setActor(tx, ctx.userId);
      const head = await findPgr(tx, ctx.tenantId, pgrId, true);
      if (!head) throw new NotFoundError();
      const events = await selectEvents(tx, ctx.tenantId, pgrId);
      const values = await build({ tx, head, events });
      const [row] = await tx
        .insert(approvals)
        .values({ ...values, orgId: ctx.tenantId, pgrId, actor: ctx.userId })
        .returning(eventColumns);
      return row;
    }),
  );
}

export async function insertFinalIssueDocument(
  tx: TenantTransaction,
  ctx: TenantContext,
  pgrId: string,
  document: FinalIssueDocument,
): Promise<string> {
  const [row] = await tx
    .insert(documents)
    .values({
      orgId: ctx.tenantId,
      documentGroupId: document.documentGroupId,
      name: document.name,
      docType: "PGR — emissão final",
      storagePath: document.storagePath,
      sizeBytes: document.sizeBytes,
      relatedEntityType: "pgr",
      relatedEntityId: pgrId,
    })
    .returning({ id: documents.id });
  return row.id;
}
