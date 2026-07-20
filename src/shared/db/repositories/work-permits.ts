import "server-only";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import type {
  WorkPermitDetail,
  WorkPermitListItem,
  WorkPermitValues,
} from "@/shared/domains/work-permits/work-permits";
import { toWorkPermitListItem } from "@/shared/domains/work-permits/work-permits";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";

import { companies, workPermits } from "../schema";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const WRITE_EVENT = "work_permits.write_rejected";
const countExpr = sql<number>`count(*)::int`;

export type ListWorkPermitsParams = PageParams & {
  search?: string;
  status?: string;
  type?: string;
};

export async function listWorkPermits(
  orgId: string,
  params: ListWorkPermitsParams = {},
): Promise<Paginated<WorkPermitListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(workPermits.orgId, orgId)];
  const search = params.search?.trim();
  if (search) {
    filters.push(
      or(
        ilike(workPermits.number, `%${search}%`),
        ilike(workPermits.description, `%${search}%`),
      ) as SQL,
    );
  }
  if (params.status) filters.push(eq(workPermits.status, params.status as "draft"));
  if (params.type) filters.push(eq(workPermits.type, params.type as "hot_work"));
  const where = and(...filters);
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: workPermits.id,
        number: workPermits.number,
        type: workPermits.type,
        status: workPermits.status,
        companyName: companies.razaoSocial,
        validFrom: workPermits.validFrom,
        validUntil: workPermits.validUntil,
      })
      .from(workPermits)
      .leftJoin(companies, eq(companies.id, workPermits.companyId))
      .where(where)
      .orderBy(desc(workPermits.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: countExpr })
      .from(workPermits)
      .where(where);
    return { rows: rows.map(toWorkPermitListItem), total };
  });
}

export async function getWorkPermit(
  orgId: string,
  id: string,
): Promise<WorkPermitDetail | null> {
  return withOrg(orgId, async (tx) => {
    const [permit] = await tx
      .select()
      .from(workPermits)
      .where(and(eq(workPermits.orgId, orgId), eq(workPermits.id, id)))
      .limit(1);
    if (!permit) return null;
    const [company] = permit.companyId
      ? await tx
          .select({ id: companies.id, razaoSocial: companies.razaoSocial })
          .from(companies)
          .where(eq(companies.id, permit.companyId))
          .limit(1)
      : [];
    return { permit, company: company ?? null };
  });
}

async function assertCompany(
  tx: TenantTransaction,
  orgId: string,
  companyId: string | null | undefined,
): Promise<void> {
  if (!companyId) return;
  const [c] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
    .limit(1);
  if (!c) throw new ReferenceNotFoundError();
}

function toColumns(input: WorkPermitValues) {
  return {
    number: input.number,
    type: input.type,
    status: input.status,
    companyId: input.companyId ?? null,
    area: input.area ?? null,
    description: input.description,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    requestedBy: input.requestedBy ?? null,
    approvedBy: input.approvedBy ?? null,
    precautions: input.precautions ?? null,
    notes: input.notes ?? null,
  };
}

export async function createWorkPermit(
  orgId: string,
  input: WorkPermitValues,
): Promise<{ id: string }> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      await assertCompany(tx, orgId, input.companyId);
      // Nº duplicado por org viola uq_work_permits_org_number (23505) → DUPLICATE.
      const [row] = await tx
        .insert(workPermits)
        .values({ orgId, ...toColumns(input) })
        .returning({ id: workPermits.id });
      return { id: row.id };
    }),
  );
}

export async function updateWorkPermit(
  orgId: string,
  id: string,
  input: WorkPermitValues,
): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      await assertCompany(tx, orgId, input.companyId);
      const [row] = await tx
        .update(workPermits)
        .set({ ...toColumns(input), updatedAt: new Date() })
        .where(and(eq(workPermits.orgId, orgId), eq(workPermits.id, id)))
        .returning({ id: workPermits.id });
      return !!row;
    }),
  );
}

export async function deleteWorkPermit(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, WRITE_EVENT, () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(workPermits)
        .where(and(eq(workPermits.orgId, orgId), eq(workPermits.id, id)))
        .returning({ id: workPermits.id });
      return rows.length > 0;
    }),
  );
}
