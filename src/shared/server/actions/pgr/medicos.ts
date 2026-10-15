"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import { medicoInputSchema, type MedicoInput } from "@/shared/domains/pgr/medicos";
import type { MedicoOption } from "@/shared/domains/pgr/medicos";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/medicos";
import type { Medico } from "@/shared/db/schema/medicos";

const BASE_PATH = "/medicos";

export async function listMedicosAction(
  params: repo.ListMedicosParams = {},
): Promise<ActionResult<Paginated<Medico>>> {
  return officeAction("pgr.medicos.list", ({ tenantId }) =>
    repo.listMedicos(tenantId, params),
  );
}

export async function listMedicoOptionsAction(): Promise<ActionResult<MedicoOption[]>> {
  return officeAction("pgr.medicos.options", ({ tenantId }) =>
    repo.listMedicoOptions(tenantId),
  );
}

export async function listMedicoClinicsAction(): Promise<ActionResult<string[]>> {
  return officeAction("pgr.medicos.clinics", ({ tenantId }) =>
    repo.listMedicoClinics(tenantId),
  );
}

export async function getMedicoAction(id: string): Promise<ActionResult<Medico>> {
  return officeAction("pgr.medicos.get", async ({ tenantId }) => {
    const medico = await repo.getMedicoById(tenantId, id);
    if (!medico) throw new NotFoundError();
    return medico;
  });
}

export async function createMedicoAction(
  input: MedicoInput,
): Promise<ActionResult<Medico>> {
  return officeAction(
    "pgr.medicos.create",
    async ({ tenantId }) => {
      const data = medicoInputSchema.parse(input);
      const medico = await repo.createMedico(tenantId, data);
      revalidatePath(BASE_PATH);
      return medico;
    },
    { audit: true },
  );
}

export async function updateMedicoAction(
  id: string,
  input: MedicoInput,
): Promise<ActionResult<Medico>> {
  return officeAction(
    "pgr.medicos.update",
    async ({ tenantId }) => {
      const data = medicoInputSchema.parse(input);
      const medico = await repo.updateMedico(tenantId, id, data);
      if (!medico) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}/edit`);
      return medico;
    },
    { audit: true },
  );
}

export async function deleteMedicoAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.medicos.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteMedico(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}
