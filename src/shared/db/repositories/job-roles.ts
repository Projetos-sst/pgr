import "server-only";

import { and, desc, eq, getTableColumns, ilike, or, sql, type SQL } from "drizzle-orm";

import type { JobRoleValues, JobRoleListItem } from "@/shared/domains/pgr/job-roles";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { withOrg, type TenantTransaction } from "../with-org";
import { jobRoles, type JobRole } from "../schema/job-roles";
import { companies } from "../schema/companies";
import { ges } from "../schema/ges";
import { gesJobRoles } from "../schema/ges-job-roles";
import { employees } from "../schema/employees";
import { auditedTenantWrite } from "./audited-write";

export type ListJobRolesParams = PageParams & {
  companyId?: string;
  gesId?: string;
  isActive?: boolean;
  search?: string;
};

function toJobRoleColumns(input: JobRoleValues) {
  return {
    companyId: input.companyId,
    title: input.title,
    cbo: input.cbo ?? null,
    sector: input.sector ?? null,
    workSchedule: input.workSchedule ?? null,
    description: input.description ?? null,
    isActive: input.isActive,
  };
}

/** Garante que o GES existe no tenant (senão FK_NOT_FOUND). */
async function assertGesInTenant(
  tx: TenantTransaction,
  orgId: string,
  gesId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: ges.id })
    .from(ges)
    .where(and(eq(ges.orgId, orgId), eq(ges.id, gesId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("ges");
}

/**
 * Vincula a função a um GES (form #194) via `ges_job_roles`, de forma **aditiva e
 * segura**: cria o vínculo se não existir, ou atualiza o `worker_count` do vínculo
 * existente. **Nunca remove** vínculos — a gestão M:N completa fica na tela de GES,
 * evitando perda de dados ao editar pela função. `worker_count` default 1 (>0).
 */
async function linkJobRoleToGes(
  tx: TenantTransaction,
  orgId: string,
  jobRoleId: string,
  gesId: string,
  workerCount: number,
): Promise<void> {
  await assertGesInTenant(tx, orgId, gesId);
  const [existing] = await tx
    .select({ id: gesJobRoles.id })
    .from(gesJobRoles)
    .where(
      and(
        eq(gesJobRoles.orgId, orgId),
        eq(gesJobRoles.gesId, gesId),
        eq(gesJobRoles.jobRoleId, jobRoleId),
      ),
    )
    .limit(1);
  if (existing) {
    await tx
      .update(gesJobRoles)
      .set({ workerCount, updatedAt: new Date() })
      .where(eq(gesJobRoles.id, existing.id));
  } else {
    await tx.insert(gesJobRoles).values({ orgId, gesId, jobRoleId, workerCount });
  }
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
): Promise<Paginated<JobRoleListItem>> {
  const { limit, offset } = resolvePageParams(params);
  const filters: SQL[] = [eq(jobRoles.orgId, orgId)];
  if (params.companyId) filters.push(eq(jobRoles.companyId, params.companyId));
  if (params.isActive !== undefined) {
    filters.push(eq(jobRoles.isActive, params.isActive));
  }
  if (params.gesId) {
    // EXISTS: funções vinculadas ao GES informado (via ges_job_roles).
    filters.push(
      sql`exists (
        select 1 from "ges_job_roles" gjr
        where gjr."job_role_id" = "job_roles"."id"
          and gjr."ges_id" = ${params.gesId} and gjr."org_id" = ${orgId}
      )`,
    );
  }
  const search = params.search?.trim();
  if (search) {
    const term = `%${search}%`;
    filters.push(or(ilike(jobRoles.title, term), ilike(jobRoles.cbo, term))!);
  }
  const where = and(...filters);

  // Subqueries correlacionadas QUALIFICADAS (lição do #188), escopadas ao tenant.
  const gesNames = sql<string | null>`(
    select string_agg(g."name", ', ' order by g."name")
    from "ges_job_roles" gjr
    join "ges" g on g."id" = gjr."ges_id"
    where gjr."job_role_id" = "job_roles"."id" and gjr."org_id" = ${orgId}
  )`;
  const employeeCount = sql<number>`(
    select count(*)::int from "employees" e
    where e."job_role_id" = "job_roles"."id" and e."org_id" = ${orgId}
  )`;

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({ ...getTableColumns(jobRoles), gesNames, employeeCount })
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
      if (input.gesId) {
        await linkJobRoleToGes(tx, orgId, row.id, input.gesId, input.workerCount ?? 1);
      }
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
      if (row && input.gesId) {
        await linkJobRoleToGes(tx, orgId, id, input.gesId, input.workerCount ?? 1);
      }
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
