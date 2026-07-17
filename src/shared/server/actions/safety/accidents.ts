"use server";

import { revalidatePath } from "next/cache";

import * as repo from "@/shared/db/repositories/accidents";
import { listCompanies } from "@/shared/db/repositories/companies";
import { listEmployees } from "@/shared/db/repositories/employees";
import {
  accidentCreateSchema,
  accidentFiltersSchema,
  accidentStatusTransitionSchema,
  accidentUpdateSchema,
  type AccidentCreateInput,
  type AccidentFilters,
  type AccidentListItem,
  type AccidentStatusTransitionInput,
  type AccidentUpdateInput,
} from "@/shared/domains/safety/accident";
import type { Accident } from "@/shared/db/schema";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";

const BASE = "/incidents";

export type SelectOption = { value: string; label: string };

/** Empresas do tenant (origem obrigatória do incidente). */
export async function listCompanyOptionsAction(): Promise<ActionResult<SelectOption[]>> {
  return officeAction("safety.accidents.company_options", async ({ tenantId }) => {
    const { rows } = await listCompanies(tenantId, { pageSize: 100 });
    return rows.map((c) => ({ value: c.id, label: c.razaoSocial }));
  });
}

/** Funcionários do tenant (vínculo opcional do incidente). */
export async function listEmployeeOptionsAction(): Promise<ActionResult<SelectOption[]>> {
  return officeAction("safety.accidents.employee_options", async ({ tenantId }) => {
    const { rows } = await listEmployees(tenantId, { pageSize: 100 });
    return rows.map((e) => ({ value: e.id, label: e.fullName }));
  });
}

export async function listAccidentsAction(
  input: AccidentFilters = {},
): Promise<ActionResult<Paginated<AccidentListItem>>> {
  return officeAction("safety.accidents.list", ({ tenantId }) =>
    repo.listAccidents(tenantId, accidentFiltersSchema.parse(input)),
  );
}

export async function getAccidentAction(id: string): Promise<ActionResult<Accident>> {
  return officeAction("safety.accidents.get", async ({ tenantId }) => {
    const row = await repo.getAccidentById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createAccidentAction(
  input: AccidentCreateInput,
): Promise<ActionResult<Accident>> {
  return officeAction(
    "safety.accidents.create",
    async ({ tenantId }) => {
      const row = await repo.createAccident(tenantId, accidentCreateSchema.parse(input));
      revalidatePath(BASE);
      return row;
    },
    { audit: true },
  );
}

export async function updateAccidentAction(
  id: string,
  input: AccidentUpdateInput,
): Promise<ActionResult<Accident>> {
  return officeAction(
    "safety.accidents.update",
    async ({ tenantId }) => {
      const row = await repo.updateAccident(
        tenantId,
        id,
        accidentUpdateSchema.parse(input),
      );
      if (!row) throw new NotFoundError();
      revalidatePath(BASE);
      revalidatePath(`${BASE}/${id}`);
      return row;
    },
    { audit: true },
  );
}

export async function deleteAccidentAction(
  id: string,
): Promise<ActionResult<{ deleted: true }>> {
  return officeAction(
    "safety.accidents.delete",
    async ({ tenantId }) => {
      const ok = await repo.deleteAccident(tenantId, id);
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { deleted: true as const };
    },
    { audit: true },
  );
}

export async function setAccidentStatusAction(
  id: string,
  input: AccidentStatusTransitionInput,
): Promise<ActionResult<Accident>> {
  return officeAction(
    "safety.accidents.set_status",
    async ({ tenantId }) => {
      const { status, justification } = accidentStatusTransitionSchema.parse(input);
      const row = await repo.setAccidentStatus(tenantId, id, status, justification);
      if (!row) throw new NotFoundError();
      revalidatePath(BASE);
      revalidatePath(`${BASE}/${id}`);
      return row;
    },
    { audit: true },
  );
}
