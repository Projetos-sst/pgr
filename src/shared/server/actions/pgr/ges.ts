"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  gesInputSchema,
  gesJobRoleInputSchema,
  gesJobRoleUpdateSchema,
  type GesInput,
  type GesJobRoleInput,
  type GesJobRoleItem,
  type GesJobRoleUpdateInput,
  type JobRoleOption,
} from "@/shared/domains/pgr/ges";
import * as gesRepo from "@/shared/db/repositories/ges";
import * as linkRepo from "@/shared/db/repositories/ges-job-roles";
import type { Ges } from "@/shared/db/schema/ges";

const BASE_PATH = "/ges";

export async function listGesAction(
  params: gesRepo.ListGesParams = {},
): Promise<ActionResult<gesRepo.GesListResult>> {
  return officeAction("pgr.ges.list", ({ tenantId }) =>
    gesRepo.listGes(tenantId, params),
  );
}

/** Opções (id + nome) de GES — usado no select de GES-inline da função (#194). */
export async function listGesOptionsAction(): Promise<ActionResult<gesRepo.GesOption[]>> {
  return officeAction("pgr.ges.options", ({ tenantId }) =>
    gesRepo.listGesOptions(tenantId),
  );
}

export async function getGesAction(
  id: string,
): Promise<ActionResult<{ ges: Ges; exposedWorkers: number }>> {
  return officeAction("pgr.ges.get", async ({ tenantId }) => {
    const found = await gesRepo.getGesById(tenantId, id);
    if (!found) throw new NotFoundError();
    const exposedWorkers = await gesRepo.countExposedWorkersByGes(tenantId, id);
    return { ges: found, exposedWorkers };
  });
}

export async function createGesAction(input: GesInput): Promise<ActionResult<Ges>> {
  return officeAction(
    "pgr.ges.create",
    async ({ tenantId }) => {
      const data = gesInputSchema.parse(input);
      const row = await gesRepo.createGes(tenantId, data);
      revalidatePath(BASE_PATH);
      return row;
    },
    { audit: true },
  );
}

export async function updateGesAction(
  id: string,
  input: GesInput,
): Promise<ActionResult<Ges>> {
  return officeAction(
    "pgr.ges.update",
    async ({ tenantId }) => {
      const data = gesInputSchema.parse(input);
      const row = await gesRepo.updateGes(tenantId, id, data);
      if (!row) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}/edit`);
      return row;
    },
    { audit: true },
  );
}

export async function deleteGesAction(id: string): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.ges.delete",
    async ({ tenantId }) => {
      const deleted = await gesRepo.deleteGes(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}

export async function getGesDependentsAction(
  id: string,
): Promise<ActionResult<{ jobRoleLinks: number; employees: number }>> {
  return officeAction("pgr.ges.dependents", ({ tenantId }) =>
    gesRepo.countGesDependents(tenantId, id),
  );
}

export async function listGesJobRolesAction(
  gesId: string,
): Promise<ActionResult<GesJobRoleItem[]>> {
  return officeAction("pgr.ges_job_roles.list", ({ tenantId }) =>
    linkRepo.listGesJobRoles(tenantId, { gesId }),
  );
}

export async function listAvailableJobRolesAction(
  gesId: string,
): Promise<ActionResult<JobRoleOption[]>> {
  return officeAction("pgr.ges_job_roles.available", ({ tenantId }) =>
    linkRepo.listAvailableJobRolesForGes(tenantId, gesId),
  );
}

export async function addGesJobRoleAction(
  input: GesJobRoleInput,
): Promise<ActionResult<{ gesId: string }>> {
  return officeAction(
    "pgr.ges_job_roles.add",
    async ({ tenantId }) => {
      const data = gesJobRoleInputSchema.parse(input);
      await linkRepo.createGesJobRole(tenantId, data);
      revalidatePath(`${BASE_PATH}/${data.gesId}`);
      return { gesId: data.gesId };
    },
    { audit: true },
  );
}

export async function updateGesJobRoleAction(
  id: string,
  gesId: string,
  input: GesJobRoleUpdateInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.ges_job_roles.update",
    async ({ tenantId }) => {
      const data = gesJobRoleUpdateSchema.parse(input);
      const row = await linkRepo.updateGesJobRole(tenantId, id, data);
      if (!row) throw new NotFoundError();
      revalidatePath(`${BASE_PATH}/${gesId}`);
      return { id };
    },
    { audit: true },
  );
}

export async function removeGesJobRoleAction(
  id: string,
  gesId: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.ges_job_roles.remove",
    async ({ tenantId }) => {
      const deleted = await linkRepo.deleteGesJobRole(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(`${BASE_PATH}/${gesId}`);
      return { id };
    },
    { audit: true },
  );
}
