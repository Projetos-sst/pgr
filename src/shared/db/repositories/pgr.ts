import "server-only";

import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";

import type { PgrValues, PgrListItem } from "@/shared/domains/pgr/pgr";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import { pgr, type Pgr } from "../schema/pgr";
import { companies } from "../schema/companies";
import { workUnits } from "../schema/work-units";
import { auditedTenantWrite } from "./audited-write";

export type ListPgrParams = PageParams & {
  companyId?: string;
  workUnitId?: string;
  search?: string;
};

function toPgrColumns(input: PgrValues) {
  return {
    companyId: input.companyId,
    workUnitId: input.workUnitId ?? null,
    responsible: input.responsible ?? null,
    registrationType: input.registrationType,
    registrationNumber: input.registrationNumber ?? null,
    issuedAt: input.issuedAt,
    validUntil: input.validUntil,
  };
}

/** Garante que a empresa existe DENTRO do tenant (senão FK_NOT_FOUND). */
async function assertCompanyInTenant(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("company");
}

/** Garante que a obra pertence à empresa informada E ao tenant (senão FK_NOT_FOUND). */
async function assertWorkUnitInCompany(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
  workUnitId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: workUnits.id })
    .from(workUnits)
    .where(
      and(
        eq(workUnits.orgId, orgId),
        eq(workUnits.id, workUnitId),
        eq(workUnits.companyId, companyId),
      ),
    )
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("work_unit");
}

export async function listPgr(
  orgId: string,
  params: ListPgrParams = {},
): Promise<Paginated<PgrListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(pgr.orgId, orgId)];
  if (params.companyId) filters.push(eq(pgr.companyId, params.companyId));
  if (params.workUnitId) filters.push(eq(pgr.workUnitId, params.workUnitId));
  const search = params.search?.trim();
  if (search) filters.push(ilike(pgr.responsible, `%${search}%`));
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: pgr.id,
        companyId: pgr.companyId,
        companyName: companies.razaoSocial,
        workUnitId: pgr.workUnitId,
        workUnitName: workUnits.name,
        responsible: pgr.responsible,
        registrationType: pgr.registrationType,
        registrationNumber: pgr.registrationNumber,
        issuedAt: pgr.issuedAt,
        validUntil: pgr.validUntil,
      })
      .from(pgr)
      .innerJoin(
        companies,
        and(eq(companies.id, pgr.companyId), eq(companies.orgId, orgId)),
      )
      .leftJoin(
        workUnits,
        and(eq(workUnits.id, pgr.workUnitId), eq(workUnits.orgId, orgId)),
      )
      .where(where)
      .orderBy(desc(pgr.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(pgr)
      .where(where);
    return { rows, total };
  });
}

export async function getPgrById(orgId: string, id: string): Promise<Pgr | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(pgr)
      .where(and(eq(pgr.orgId, orgId), eq(pgr.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createPgr(orgId: string, input: PgrValues): Promise<Pgr> {
  return auditedTenantWrite(orgId, "pgr.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertCompanyInTenant(tx, orgId, input.companyId);
      if (input.workUnitId) {
        await assertWorkUnitInCompany(tx, orgId, input.companyId, input.workUnitId);
      }
      const [row] = await tx
        .insert(pgr)
        .values({ orgId, ...toPgrColumns(input) })
        .returning();
      return row;
    }),
  );
}

export async function updatePgr(
  orgId: string,
  id: string,
  input: PgrValues,
): Promise<Pgr | null> {
  return auditedTenantWrite(orgId, "pgr.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertCompanyInTenant(tx, orgId, input.companyId);
      if (input.workUnitId) {
        await assertWorkUnitInCompany(tx, orgId, input.companyId, input.workUnitId);
      }
      const [row] = await tx
        .update(pgr)
        .set({ ...toPgrColumns(input), updatedAt: new Date() })
        .where(and(eq(pgr.orgId, orgId), eq(pgr.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deletePgr(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "pgr.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(pgr)
        .where(and(eq(pgr.orgId, orgId), eq(pgr.id, id)))
        .returning({ id: pgr.id });
      return rows.length > 0;
    }),
  );
}
