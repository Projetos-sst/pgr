import "server-only";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import {
  resolveExposedTotal,
  buildExposedWorkersMap,
} from "@/shared/domains/pgr/exposed-workers";
import { toGesListItem, type GesListItem, type GesValues } from "@/shared/domains/pgr/ges";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import { ges, type Ges } from "../schema/ges";
import { workUnits } from "../schema/work-units";
import { gesJobRoles } from "../schema/ges-job-roles";
import { employees } from "../schema/employees";
import { auditedTenantWrite } from "./audited-write";

export type ListGesParams = PageParams & {
  companyId?: string;
  workUnitId?: string;
  search?: string;
};

export type GesListResult = Paginated<GesListItem> & { totalWorkers: number };

function toGesColumns(input: GesValues) {
  return {
    companyId: input.companyId,
    workUnitId: input.workUnitId,
    name: input.name,
    processDescription: input.processDescription ?? null,
    constructionType: input.constructionType ?? null,
    ceilingHeight: input.ceilingHeight ?? null,
    floor: input.floor ?? null,
    roof: input.roof ?? null,
    lighting: input.lighting ?? null,
    ventilation: input.ventilation ?? null,
    otherCharacteristics: input.otherCharacteristics ?? null,
  };
}

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

export async function listGes(
  orgId: string,
  params: ListGesParams = {},
): Promise<GesListResult> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(ges.orgId, orgId)];
  if (params.companyId) filters.push(eq(ges.companyId, params.companyId));
  if (params.workUnitId) filters.push(eq(ges.workUnitId, params.workUnitId));
  const search = params.search?.trim();
  if (search) {
    const term = `%${search}%`;
    filters.push(or(ilike(ges.name, term), ilike(ges.processDescription, term))!);
  }
  const where = and(...filters);

  const exposedExpr = sql<number>`coalesce((select sum(r.worker_count) from ges_job_roles r where r.ges_id = ${ges.id} and r.org_id = ${orgId}), 0)::int`;

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: ges.id,
        name: ges.name,
        processDescription: ges.processDescription,
        exposed: exposedExpr,
      })
      .from(ges)
      .where(where)
      .orderBy(desc(ges.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(ges)
      .where(where);

    const [{ totalWorkers }] = await tx
      .select({
        totalWorkers: sql<number>`coalesce(sum(${gesJobRoles.workerCount}), 0)::int`,
      })
      .from(gesJobRoles)
      .innerJoin(ges, eq(ges.id, gesJobRoles.gesId))
      .where(and(eq(gesJobRoles.orgId, orgId), where));

    return {
      rows: rows.map((row) =>
        toGesListItem(row, { total: row.exposed }),
      ),
      total,
      totalWorkers,
    };
  });
}

export async function getGesById(orgId: string, id: string): Promise<Ges | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(ges)
      .where(and(eq(ges.orgId, orgId), eq(ges.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createGes(orgId: string, input: GesValues): Promise<Ges> {
  return auditedTenantWrite(orgId, "pgr.ges.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertWorkUnitInCompany(tx, orgId, input.companyId, input.workUnitId);
      const [row] = await tx
        .insert(ges)
        .values({ orgId, ...toGesColumns(input) })
        .returning();
      return row;
    }),
  );
}

export async function updateGes(
  orgId: string,
  id: string,
  input: GesValues,
): Promise<Ges | null> {
  return auditedTenantWrite(orgId, "pgr.ges.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertWorkUnitInCompany(tx, orgId, input.companyId, input.workUnitId);
      const [row] = await tx
        .update(ges)
        .set({ ...toGesColumns(input), updatedAt: new Date() })
        .where(and(eq(ges.orgId, orgId), eq(ges.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteGes(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "pgr.ges.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(ges)
        .where(and(eq(ges.orgId, orgId), eq(ges.id, id)))
        .returning({ id: ges.id });
      return rows.length > 0;
    }),
  );
}

export async function countExposedWorkersByGes(
  orgId: string,
  gesId: string,
): Promise<number> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({
        total: sql<number>`coalesce(sum(${gesJobRoles.workerCount}), 0)::int`,
      })
      .from(gesJobRoles)
      .where(and(eq(gesJobRoles.orgId, orgId), eq(gesJobRoles.gesId, gesId)));
    return resolveExposedTotal(row);
  });
}

export async function countGesDependents(
  orgId: string,
  gesId: string,
): Promise<{ jobRoleLinks: number; employees: number }> {
  return withOrg(orgId, async (tx) => {
    const [links] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(gesJobRoles)
      .where(and(eq(gesJobRoles.orgId, orgId), eq(gesJobRoles.gesId, gesId)));
    const [emps] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(employees)
      .where(and(eq(employees.orgId, orgId), eq(employees.gesId, gesId)));
    return { jobRoleLinks: links.total, employees: emps.total };
  });
}

export async function exposedWorkersByGesMap(
  orgId: string,
): Promise<Record<string, number>> {
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        gesId: ges.id,
        total: sql<number>`coalesce(sum(${gesJobRoles.workerCount}), 0)::int`,
      })
      .from(ges)
      .leftJoin(gesJobRoles, eq(gesJobRoles.gesId, ges.id))
      .where(eq(ges.orgId, orgId))
      .groupBy(ges.id);
    return buildExposedWorkersMap(rows);
  });
}
