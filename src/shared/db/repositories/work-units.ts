import "server-only";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import type { WorkUnitValues } from "@/shared/domains/pgr/work-units";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import { workUnits, type WorkUnit } from "../schema/work-units";
import { companies } from "../schema/companies";
import { ges } from "../schema/ges";
import { auditedTenantWrite } from "./audited-write";

export type ListWorkUnitsParams = PageParams & { companyId?: string; search?: string };

function toWorkUnitColumns(input: WorkUnitValues) {
  return {
    companyId: input.companyId,
    name: input.name,
    description: input.description,
    contractNumber: input.contractNumber ?? null,
    managerName: input.managerName ?? null,
    managerRole: input.managerRole ?? null,
    professionalTitle: input.professionalTitle ?? null,
    professionalRegistration: input.professionalRegistration ?? null,
    zipCode: input.zipCode ?? null,
    street: input.street ?? null,
    number: input.number ?? null,
    complement: input.complement ?? null,
    district: input.district ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
  };
}

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

export async function listWorkUnits(
  orgId: string,
  params: ListWorkUnitsParams = {},
): Promise<Paginated<WorkUnit>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(workUnits.orgId, orgId)];
  if (params.companyId) filters.push(eq(workUnits.companyId, params.companyId));
  const search = params.search?.trim();
  if (search) {
    const term = `%${search}%`;
    filters.push(
      or(
        ilike(workUnits.name, term),
        ilike(workUnits.contractNumber, term),
        ilike(workUnits.description, term),
      )!,
    );
  }
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(workUnits)
      .where(where)
      .orderBy(desc(workUnits.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(workUnits)
      .where(where);
    return { rows, total };
  });
}

export async function getWorkUnitById(
  orgId: string,
  id: string,
): Promise<WorkUnit | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(workUnits)
      .where(and(eq(workUnits.orgId, orgId), eq(workUnits.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createWorkUnit(
  orgId: string,
  input: WorkUnitValues,
): Promise<WorkUnit> {
  return auditedTenantWrite(orgId, "pgr.work_units.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertCompanyInTenant(tx, orgId, input.companyId);
      const [row] = await tx
        .insert(workUnits)
        .values({ orgId, ...toWorkUnitColumns(input) })
        .returning();
      return row;
    }),
  );
}

export async function updateWorkUnit(
  orgId: string,
  id: string,
  input: WorkUnitValues,
): Promise<WorkUnit | null> {
  return auditedTenantWrite(orgId, "pgr.work_units.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertCompanyInTenant(tx, orgId, input.companyId);
      const [row] = await tx
        .update(workUnits)
        .set({ ...toWorkUnitColumns(input), updatedAt: new Date() })
        .where(and(eq(workUnits.orgId, orgId), eq(workUnits.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteWorkUnit(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "pgr.work_units.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(workUnits)
        .where(and(eq(workUnits.orgId, orgId), eq(workUnits.id, id)))
        .returning({ id: workUnits.id });
      return rows.length > 0;
    }),
  );
}

export async function countWorkUnitDependents(
  orgId: string,
  id: string,
): Promise<{ ges: number }> {
  return withOrg(orgId, async (tx) => {
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(ges)
      .where(and(eq(ges.orgId, orgId), eq(ges.workUnitId, id)));
    return { ges: total };
  });
}
