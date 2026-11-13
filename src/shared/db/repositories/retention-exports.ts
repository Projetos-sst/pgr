import "server-only";

import { and, count, desc, eq, inArray } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import type { RetentionExportStatus } from "@/shared/domains/retention/export-manifest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { resolvePageParams, type PageParams } from "@/shared/pagination";

import { documents } from "../schema/documents";
import { pgr, pgrRevisions } from "../schema/pgr";
import { pgrDocumentApprovals } from "../schema/pgr-document-approvals";
import { pgrReviewDecisions, pgrReviewSamples } from "../schema/pgr-document-reviews";
import { pgrDocxTextVersions } from "../schema/pgr-docx-text-versions";
import { retentionExports as exportsTable } from "../schema/retention";
import { signatureCaptures, signatureRequests } from "../schema/signatures";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";
import { latestRetentionPolicyVersion } from "./retention-policy";

const PGR_TARGET = "pgr";

const signatureRequestColumns = {
  id: signatureRequests.id,
  orgId: signatureRequests.orgId,
  targetType: signatureRequests.targetType,
  targetId: signatureRequests.targetId,
  payload: signatureRequests.payload,
  status: signatureRequests.status,
  expiresAt: signatureRequests.expiresAt,
  usedAt: signatureRequests.usedAt,
  createdAt: signatureRequests.createdAt,
  updatedAt: signatureRequests.updatedAt,
};

const exportColumns = {
  id: exportsTable.id,
  status: exportsTable.status,
  contentSha256: exportsTable.contentSha256,
  itemCount: exportsTable.itemCount,
  missingCount: exportsTable.missingCount,
  hashMismatchCount: exportsTable.hashMismatchCount,
  failureReason: exportsTable.failureReason,
  exportedBy: exportsTable.exportedBy,
  createdAt: exportsTable.createdAt,
};

export type RetentionExportRecord = {
  id: string;
  status: RetentionExportStatus;
  contentSha256: string | null;
  itemCount: number;
  missingCount: number;
  hashMismatchCount: number;
  failureReason: string | null;
  exportedBy: string;
  createdAt: Date;
};

export type NewRetentionExport = Omit<
  RetentionExportRecord,
  "id" | "exportedBy" | "createdAt"
>;

async function requireVisiblePgr(tx: TenantTransaction, orgId: string, pgrId: string) {
  const [head] = await tx
    .select()
    .from(pgr)
    .where(and(eq(pgr.orgId, orgId), eq(pgr.id, pgrId)))
    .limit(1);
  if (!head) throw new NotFoundError();
  return head;
}

async function reviewRecords(tx: TenantTransaction, orgId: string, pgrId: string) {
  const samples = await tx
    .select()
    .from(pgrReviewSamples)
    .where(and(eq(pgrReviewSamples.orgId, orgId), eq(pgrReviewSamples.pgrId, pgrId)));
  const decisions = await tx
    .select()
    .from(pgrReviewDecisions)
    .where(
      and(
        eq(pgrReviewDecisions.orgId, orgId),
        inArray(
          pgrReviewDecisions.sampleId,
          samples.map((sample) => sample.id),
        ),
      ),
    );
  const approvals = await tx
    .select()
    .from(pgrDocumentApprovals)
    .where(
      and(eq(pgrDocumentApprovals.orgId, orgId), eq(pgrDocumentApprovals.pgrId, pgrId)),
    );
  const textVersions = await tx
    .select()
    .from(pgrDocxTextVersions)
    .where(
      and(eq(pgrDocxTextVersions.orgId, orgId), eq(pgrDocxTextVersions.pgrId, pgrId)),
    );
  return { samples, decisions, approvals, textVersions };
}

async function signatureRecords(tx: TenantTransaction, orgId: string, pgrId: string) {
  const requests = await tx
    .select(signatureRequestColumns)
    .from(signatureRequests)
    .where(
      and(
        eq(signatureRequests.orgId, orgId),
        eq(signatureRequests.targetType, PGR_TARGET),
        eq(signatureRequests.targetId, pgrId),
      ),
    );
  const captures = await tx
    .select()
    .from(signatureCaptures)
    .where(
      and(
        eq(signatureCaptures.orgId, orgId),
        inArray(
          signatureCaptures.requestId,
          requests.map((request) => request.id),
        ),
      ),
    );
  return { requests, captures };
}

export function loadPgrExportRecords(ctx: TenantContext, pgrId: string) {
  const orgId = ctx.tenantId;
  const read = async (tx: TenantTransaction) => {
    const head = await requireVisiblePgr(tx, orgId, pgrId);
    const revisions = await tx
      .select()
      .from(pgrRevisions)
      .where(and(eq(pgrRevisions.orgId, orgId), eq(pgrRevisions.pgrId, pgrId)));
    const files = await tx
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.orgId, orgId),
          eq(documents.relatedEntityType, PGR_TARGET),
          eq(documents.relatedEntityId, pgrId),
        ),
      );
    return {
      head,
      revisions,
      files,
      ...(await reviewRecords(tx, orgId, pgrId)),
      ...(await signatureRecords(tx, orgId, pgrId)),
      policy: await latestRetentionPolicyVersion(tx, orgId),
    };
  };
  return withOrg(orgId, read, {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}

export type PgrExportRecords = Awaited<ReturnType<typeof loadPgrExportRecords>>;

export function recordRetentionExport(
  ctx: TenantContext,
  pgrId: string,
  input: NewRetentionExport,
): Promise<string> {
  return auditedTenantWrite(ctx.tenantId, "retention.export.record", () =>
    withOrg(ctx.tenantId, async (tx) => {
      const [row] = await tx
        .insert(exportsTable)
        .values({ ...input, orgId: ctx.tenantId, pgrId, exportedBy: ctx.userId })
        .returning({ id: exportsTable.id });
      return row.id;
    }),
  );
}

export function listRetentionExports(
  ctx: TenantContext,
  pgrId: string,
  page: PageParams = {},
) {
  const scope = and(eq(exportsTable.orgId, ctx.tenantId), eq(exportsTable.pgrId, pgrId));
  return withOrg(ctx.tenantId, async (tx) => {
    await requireVisiblePgr(tx, ctx.tenantId, pgrId);
    const { limit, offset } = resolvePageParams(page);
    const rows: RetentionExportRecord[] = await tx
      .select(exportColumns)
      .from(exportsTable)
      .where(scope)
      .orderBy(desc(exportsTable.seq))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: count() })
      .from(exportsTable)
      .where(scope);
    return { rows, total };
  });
}
