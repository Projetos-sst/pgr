"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  employeeInputSchema,
  type EmployeeInput,
  type EmployeeListItem,
} from "@/shared/domains/pgr/employees";
import { validatePhotoFile } from "@/shared/domains/pgr/employee-photo";
import type { JobRoleOption } from "@/shared/domains/pgr/ges";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/employees";
import { listGesJobRoles } from "@/shared/db/repositories/ges-job-roles";
import type { Employee } from "@/shared/db/schema/employees";
import {
  getSignedEmployeePhotoUrl,
  putEmployeePhoto,
} from "@/shared/integrations/storage/employee-photo-storage";

const BASE_PATH = "/employees";

export async function listEmployeesAction(
  params: repo.ListEmployeesParams = {},
): Promise<ActionResult<Paginated<EmployeeListItem>>> {
  return officeAction("pgr.employees.list", ({ tenantId }) =>
    repo.listEmployees(tenantId, params),
  );
}

export async function getEmployeeAction(id: string): Promise<ActionResult<Employee>> {
  return officeAction("pgr.employees.get", async ({ tenantId }) => {
    const row = await repo.getEmployeeById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createEmployeeAction(
  input: EmployeeInput,
): Promise<ActionResult<Employee>> {
  return officeAction(
    "pgr.employees.create",
    async ({ tenantId }) => {
      const data = employeeInputSchema.parse(input);
      const row = await repo.createEmployee(tenantId, data);
      revalidatePath(BASE_PATH);
      return row;
    },
    { audit: true },
  );
}

export async function updateEmployeeAction(
  id: string,
  input: EmployeeInput,
): Promise<ActionResult<Employee>> {
  return officeAction(
    "pgr.employees.update",
    async ({ tenantId }) => {
      const data = employeeInputSchema.parse(input);
      const row = await repo.updateEmployee(tenantId, id, data);
      if (!row) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}`);
      revalidatePath(`${BASE_PATH}/${id}/edit`);
      return row;
    },
    { audit: true },
  );
}

export async function deleteEmployeeAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.employees.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteEmployee(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}

export type UploadEmployeePhotoResult = { storagePath: string; url: string };

/**
 * Envia o arquivo de foto ao Storage e devolve o path (persistido em
 * `photoPath` no create/update do form) + uma URL assinada para preview
 * imediato no formulário (issue #16). Não toca o registro de `employees` —
 * quem persiste o path é `createEmployeeAction`/`updateEmployeeAction`, como
 * qualquer outro campo do formulário. Mesmo padrão de
 * `uploadCompanyLogoAction` (issue #4).
 */
export async function uploadEmployeePhotoAction(
  formData: FormData,
): Promise<ActionResult<UploadEmployeePhotoResult>> {
  return officeAction("pgr.employees.upload_photo", async ({ tenantId }) => {
    const raw = formData.get("file");
    const file = raw instanceof File ? raw : null;
    const check = validatePhotoFile(file);
    if (!check.ok) throw new ValidationError(check.message);

    const stored = await putEmployeePhoto(tenantId, file!, check.extension);
    const url = await getSignedEmployeePhotoUrl(stored.storagePath);
    return { storagePath: stored.storagePath, url };
  });
}

export async function listGesFunctionsAction(
  gesId: string,
): Promise<ActionResult<JobRoleOption[]>> {
  return officeAction("pgr.employees.ges_functions", async ({ tenantId }) => {
    const linked = await listGesJobRoles(tenantId, { gesId });
    return linked.map((item) => ({ jobRoleId: item.jobRoleId, title: item.title }));
  });
}
