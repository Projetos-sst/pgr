import "server-only";

import { count, desc, eq, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import type {
  RetentionPolicyStatus,
  RetentionTerms,
} from "@/shared/domains/retention/policy";
import { resolvePageParams, type PageParams } from "@/shared/pagination";

import { retentionPolicyVersions as versions } from "../schema/retention";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const versionNumber = sql<number>`(select count(*)::int from public.retention_policy_versions older where older.org_id = retention_policy_versions.org_id and older.seq <= retention_policy_versions.seq)`;

const columns = {
  id: versions.id,
  version: versionNumber,
  status: versions.status,
  terms: versions.terms,
  termsSha256: versions.termsSha256,
  approverName: versions.approverName,
  approverRole: versions.approverRole,
  approvedOn: versions.approvedOn,
  approvalReference: versions.approvalReference,
  recordedBy: versions.recordedBy,
  createdAt: versions.createdAt,
};

export type RetentionPolicyVersion = {
  id: string;
  version: number;
  status: RetentionPolicyStatus;
  terms: RetentionTerms;
  termsSha256: string;
  approverName: string | null;
  approverRole: string | null;
  approvedOn: string | null;
  approvalReference: string | null;
  recordedBy: string;
  createdAt: Date;
};

export type NewRetentionPolicyVersion = Pick<
  RetentionPolicyVersion,
  | "status"
  | "terms"
  | "termsSha256"
  | "approverName"
  | "approverRole"
  | "approvedOn"
  | "approvalReference"
>;

export async function latestRetentionPolicyVersion(
  tx: TenantTransaction,
  orgId: string,
): Promise<RetentionPolicyVersion | null> {
  const [row] = await tx
    .select(columns)
    .from(versions)
    .where(eq(versions.orgId, orgId))
    .orderBy(desc(versions.seq))
    .limit(1);
  return row ?? null;
}

export function getLatestRetentionPolicyVersion(ctx: TenantContext) {
  return withOrg(ctx.tenantId, (tx) => latestRetentionPolicyVersion(tx, ctx.tenantId));
}

export function insertRetentionPolicyVersion(
  ctx: TenantContext,
  input: NewRetentionPolicyVersion,
): Promise<RetentionPolicyVersion> {
  return auditedTenantWrite(ctx.tenantId, "retention.policy.record", () =>
    withOrg(ctx.tenantId, async (tx) => {
      const [inserted] = await tx
        .insert(versions)
        .values({ ...input, orgId: ctx.tenantId, recordedBy: ctx.userId })
        .returning({ id: versions.id });
      const [row] = await tx
        .select(columns)
        .from(versions)
        .where(eq(versions.id, inserted.id));
      return row;
    }),
  );
}

export function listRetentionPolicyVersions(ctx: TenantContext, page: PageParams = {}) {
  return withOrg(ctx.tenantId, async (tx) => {
    const { limit, offset } = resolvePageParams(page);
    const rows: RetentionPolicyVersion[] = await tx
      .select(columns)
      .from(versions)
      .where(eq(versions.orgId, ctx.tenantId))
      .orderBy(desc(versions.seq))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: count() })
      .from(versions)
      .where(eq(versions.orgId, ctx.tenantId));
    const current = await latestRetentionPolicyVersion(tx, ctx.tenantId);
    return { rows, total, current };
  });
}
