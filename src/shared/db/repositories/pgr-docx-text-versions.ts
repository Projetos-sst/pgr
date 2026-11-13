import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import type { PgrDocxStoredOverrides } from "@/shared/domains/pgr/pgr-docx/text-overrides";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { resolvePageParams, type PageParams } from "@/shared/pagination";
import { pgr } from "../schema/pgr";
import { pgrDocxTextVersions as versions } from "../schema/pgr-docx-text-versions";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const versionNumber = sql<number>`(select count(*)::int from public.pgr_docx_text_versions older where older.org_id = pgr_docx_text_versions.org_id and older.pgr_id = pgr_docx_text_versions.pgr_id and older.seq <= pgr_docx_text_versions.seq)`;

const columns = {
  id: versions.id,
  version: versionNumber,
  overrides: versions.overrides,
  textsSha256: versions.textsSha256,
  reason: versions.reason,
  createdBy: versions.createdBy,
  createdAt: versions.createdAt,
};

export type PgrDocxTextVersion = {
  id: string;
  version: number;
  overrides: PgrDocxStoredOverrides;
  textsSha256: string;
  reason: string;
  createdBy: string;
  createdAt: Date;
};

type NewPgrDocxTextVersion = {
  overrides: PgrDocxStoredOverrides;
  textsSha256: string;
  reason: string;
};

function ofPgr(orgId: string, pgrId: string) {
  return and(eq(versions.orgId, orgId), eq(versions.pgrId, pgrId));
}

async function requireVisiblePgr(tx: TenantTransaction, orgId: string, pgrId: string) {
  const [head] = await tx
    .select({ id: pgr.id })
    .from(pgr)
    .where(and(eq(pgr.orgId, orgId), eq(pgr.id, pgrId)))
    .limit(1);
  if (!head) throw new NotFoundError();
}

export async function latestPgrDocxTextVersion(
  tx: TenantTransaction,
  orgId: string,
  pgrId: string,
): Promise<PgrDocxTextVersion | null> {
  const [row] = await tx
    .select(columns)
    .from(versions)
    .where(ofPgr(orgId, pgrId))
    .orderBy(desc(versions.seq))
    .limit(1);
  return row ?? null;
}

export function insertPgrDocxTextVersion(
  ctx: TenantContext,
  pgrId: string,
  input: NewPgrDocxTextVersion,
): Promise<PgrDocxTextVersion> {
  return auditedTenantWrite(ctx.tenantId, "pgr.docx_texts.save", () =>
    withOrg(ctx.tenantId, async (tx) => {
      await requireVisiblePgr(tx, ctx.tenantId, pgrId);
      const [inserted] = await tx
        .insert(versions)
        .values({ ...input, orgId: ctx.tenantId, pgrId, createdBy: ctx.userId })
        .returning({ id: versions.id });
      const [row] = await tx
        .select(columns)
        .from(versions)
        .where(eq(versions.id, inserted.id));
      return row;
    }),
  );
}

export function listPgrDocxTextVersions(
  ctx: TenantContext,
  pgrId: string,
  page: PageParams = {},
) {
  return withOrg(ctx.tenantId, async (tx) => {
    await requireVisiblePgr(tx, ctx.tenantId, pgrId);
    const { limit, offset } = resolvePageParams(page);
    const rows: PgrDocxTextVersion[] = await tx
      .select(columns)
      .from(versions)
      .where(ofPgr(ctx.tenantId, pgrId))
      .orderBy(desc(versions.seq))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: count() })
      .from(versions)
      .where(ofPgr(ctx.tenantId, pgrId));
    const current = await latestPgrDocxTextVersion(tx, ctx.tenantId, pgrId);
    return { rows, total, current };
  });
}
