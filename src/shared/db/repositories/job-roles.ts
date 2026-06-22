import "server-only";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import type { JobRoleValues } from "@/shared/domains/pgr/job-roles";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import { jobRoles, type JobRole } from "../schema/job-roles";
import { companies } from "../schema/companies";
import { gesJobRoles } from "../schema/ges-job-roles";
import { employees } from "../schema/employees";
import { auditedTenantWrite } from "./audited-write";

export type ListJobRolesParams = PageParams & { companyId?: string; search?: string };

function toJobRoleColumns(input: JobRoleValues) {
  return {
    companyId: input.companyId,
    title: input.title,
    cbo: input.cbo ?? null,
    workSchedule: input.workSchedule ?? null,
    description: input.description ?? null,
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

export async function listJobRoles(
  orgId: string,
  params: ListJobRolesParams = {},
): Promise<Paginated<JobRole>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(jobRoles.orgId, orgId)];
  if (params.companyId) filters.push(eq(jobRoles.companyId, params.companyId));
  const search = params.search?.trim();
  if (search) {
    const term = `%${search}%`;
    filters.push(or(ilike(jobRoles.title, term), ilike(jobRoles.cbo, term))!);
  }
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(jobRoles)
      .where(where)
      .orderBy(desc(jobRoles.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(jobRoles)
      .where(where);
    return { rows, total };
  });
}

export async function getJobRoleById(orgId: string, id: string): Promise<JobRole | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(jobRoles)
      .where(and(eq(jobRoles.orgId, orgId), eq(jobRoles.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function createJobRole(
  orgId: string,
  input: JobRoleValues,
): Promise<JobRole> {
  return auditedTenantWrite(orgId, "pgr.job_roles.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertCompanyInTenant(tx, orgId, input.companyId);
      const [row] = await tx
        .insert(jobRoles)
        .values({ orgId, ...toJobRoleColumns(input) })
        .returning();
      return row;
    }),
  );
}

export async function updateJobRole(
  orgId: string,
  id: string,
  input: JobRoleValues,
): Promise<JobRole | null> {
  return auditedTenantWrite(orgId, "pgr.job_roles.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertCompanyInTenant(tx, orgId, input.companyId);
      const [row] = await tx
        .update(jobRoles)
        .set({ ...toJobRoleColumns(input), updatedAt: new Date() })
        .where(and(eq(jobRoles.orgId, orgId), eq(jobRoles.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteJobRole(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "pgr.job_roles.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(jobRoles)
        .where(and(eq(jobRoles.orgId, orgId), eq(jobRoles.id, id)))
        .returning({ id: jobRoles.id });
      return rows.length > 0;
    }),
  );
}

export async function countJobRoleDependents(
  orgId: string,
  id: string,
): Promise<{ gesLinks: number; employees: number }> {
  return withOrg(orgId, async (tx) => {
    const [links] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(gesJobRoles)
      .where(and(eq(gesJobRoles.orgId, orgId), eq(gesJobRoles.jobRoleId, id)));
    const [emps] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(employees)
      .where(and(eq(employees.orgId, orgId), eq(employees.jobRoleId, id)));
    return { gesLinks: links.total, employees: emps.total };
  });
}
