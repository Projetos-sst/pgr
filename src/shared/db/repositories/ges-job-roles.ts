import "server-only";

import { and, asc, eq, notInArray } from "drizzle-orm";

import { workerCountSchema } from "@/shared/domains/pgr/validation";
import type { GesJobRoleItem, JobRoleOption } from "@/shared/domains/pgr/ges";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";

import { withOrg, type TenantTransaction } from "../with-org";
import { gesJobRoles, type GesJobRole } from "../schema/ges-job-roles";
import { ges } from "../schema/ges";
import { jobRoles } from "../schema/job-roles";
import { auditedTenantWrite } from "./audited-write";

export type NewGesJobRoleInput = {
  gesId: string;
  jobRoleId: string;
  workerCount: number;
  workSchedule?: string | null;
};

async function loadGesCompanyId(
  tx: TenantTransaction,
  orgId: string,
  gesId: string,
): Promise<string> {
  const [row] = await tx
    .select({ companyId: ges.companyId })
    .from(ges)
    .where(and(eq(ges.orgId, orgId), eq(ges.id, gesId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("ges");
  return row.companyId;
}

async function assertJobRoleInCompany(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
  jobRoleId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: jobRoles.id })
    .from(jobRoles)
    .where(
      and(
        eq(jobRoles.orgId, orgId),
        eq(jobRoles.id, jobRoleId),
        eq(jobRoles.companyId, companyId),
      ),
    )
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("job_role");
}

export async function listGesJobRoles(
  orgId: string,
  params: { gesId: string },
): Promise<GesJobRoleItem[]> {
  return withOrg(orgId, (tx) =>
    tx
      .select({
        id: gesJobRoles.id,
        jobRoleId: gesJobRoles.jobRoleId,
        title: jobRoles.title,
        workerCount: gesJobRoles.workerCount,
        workSchedule: gesJobRoles.workSchedule,
      })
      .from(gesJobRoles)
      .innerJoin(jobRoles, eq(jobRoles.id, gesJobRoles.jobRoleId))
      .where(and(eq(gesJobRoles.orgId, orgId), eq(gesJobRoles.gesId, params.gesId)))
      .orderBy(asc(jobRoles.title)),
  );
}

export async function listAvailableJobRolesForGes(
  orgId: string,
  gesId: string,
): Promise<JobRoleOption[]> {
  return withOrg(orgId, async (tx) => {
    const companyId = await loadGesCompanyId(tx, orgId, gesId);
    const linked = tx
      .select({ jobRoleId: gesJobRoles.jobRoleId })
      .from(gesJobRoles)
      .where(and(eq(gesJobRoles.orgId, orgId), eq(gesJobRoles.gesId, gesId)));
    return tx
      .select({ jobRoleId: jobRoles.id, title: jobRoles.title })
      .from(jobRoles)
      .where(
        and(
          eq(jobRoles.orgId, orgId),
          eq(jobRoles.companyId, companyId),
          notInArray(jobRoles.id, linked),
        ),
      )
      .orderBy(asc(jobRoles.title));
  });
}

export async function createGesJobRole(
  orgId: string,
  input: NewGesJobRoleInput,
): Promise<GesJobRole> {
  const workerCount = workerCountSchema.parse(input.workerCount);
  return auditedTenantWrite(orgId, "pgr.ges_job_roles.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const companyId = await loadGesCompanyId(tx, orgId, input.gesId);
      await assertJobRoleInCompany(tx, orgId, companyId, input.jobRoleId);
      const [row] = await tx
        .insert(gesJobRoles)
        .values({
          orgId,
          gesId: input.gesId,
          jobRoleId: input.jobRoleId,
          workerCount,
          workSchedule: input.workSchedule ?? null,
        })
        .returning();
      return row;
    }),
  );
}

export async function updateGesJobRole(
  orgId: string,
  id: string,
  input: { workerCount: number; workSchedule?: string | null },
): Promise<GesJobRole | null> {
  const workerCount = workerCountSchema.parse(input.workerCount);
  const patch: { workerCount: number; updatedAt: Date; workSchedule?: string | null } = {
    workerCount,
    updatedAt: new Date(),
  };
  // Update parcial: a UI (edição inline da quantidade) e o REST enviam só workerCount.
  // workSchedule ausente PRESERVA o valor existente — gravar `?? null` apagava o horário.
  if (input.workSchedule !== undefined) {
    patch.workSchedule = input.workSchedule;
  }
  return auditedTenantWrite(orgId, "pgr.ges_job_roles.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .update(gesJobRoles)
        .set(patch)
        .where(and(eq(gesJobRoles.orgId, orgId), eq(gesJobRoles.id, id)))
        .returning();
      return row ?? null;
    }),
  );
}

export async function deleteGesJobRole(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "pgr.ges_job_roles.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(gesJobRoles)
        .where(and(eq(gesJobRoles.orgId, orgId), eq(gesJobRoles.id, id)))
        .returning({ id: gesJobRoles.id });
      return rows.length > 0;
    }),
  );
}
