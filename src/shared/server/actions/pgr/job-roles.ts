"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  jobRoleInputSchema,
  type JobRoleInput,
  type JobRoleListItem,
} from "@/shared/domains/pgr/job-roles";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/job-roles";
import type { JobRole } from "@/shared/db/schema/job-roles";

const BASE_PATH = "/job-roles";

export async function listJobRolesAction(
  params: repo.ListJobRolesParams = {},
): Promise<ActionResult<Paginated<JobRoleListItem>>> {
  return officeAction("pgr.job_roles.list", ({ tenantId }) =>
    repo.listJobRoles(tenantId, params),
  );
}

export async function getJobRoleAction(id: string): Promise<ActionResult<JobRole>> {
  return officeAction("pgr.job_roles.get", async ({ tenantId }) => {
    const row = await repo.getJobRoleById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createJobRoleAction(
  input: JobRoleInput,
): Promise<ActionResult<JobRole>> {
  return officeAction(
    "pgr.job_roles.create",
    async ({ tenantId }) => {
      const data = jobRoleInputSchema.parse(input);
      const row = await repo.createJobRole(tenantId, data);
      revalidatePath(BASE_PATH);
      return row;
    },
    { audit: true },
  );
}

export async function updateJobRoleAction(
  id: string,
  input: JobRoleInput,
): Promise<ActionResult<JobRole>> {
  return officeAction(
    "pgr.job_roles.update",
    async ({ tenantId }) => {
      const data = jobRoleInputSchema.parse(input);
      const row = await repo.updateJobRole(tenantId, id, data);
      if (!row) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}/edit`);
      return row;
    },
    { audit: true },
  );
}

export async function deleteJobRoleAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.job_roles.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteJobRole(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}

export async function getJobRoleDependentsAction(
  id: string,
): Promise<ActionResult<{ gesLinks: number; employees: number }>> {
  return officeAction("pgr.job_roles.dependents", ({ tenantId }) =>
    repo.countJobRoleDependents(tenantId, id),
  );
}
