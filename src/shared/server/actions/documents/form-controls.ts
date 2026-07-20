"use server";

import { revalidatePath } from "next/cache";

import { listCompanyOptions } from "@/shared/db/repositories/companies";
import { listGesOptions } from "@/shared/db/repositories/ges";
import * as repo from "@/shared/db/repositories/form-controls";
import {
  formControlInputSchema,
  type FormControlDetail,
  type FormControlInput,
  type FormControlListItem,
} from "@/shared/domains/documents/form-controls";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";

const BASE = "/form-controls";

export type SelectOption = { value: string; label: string };

export async function listFormControlCompanyOptionsAction(): Promise<
  ActionResult<SelectOption[]>
> {
  return officeAction("documents.form_controls.company_options", async ({ tenantId }) => {
    const options = await listCompanyOptions(tenantId);
    return options.map((c) => ({ value: c.id, label: c.razaoSocial }));
  });
}

export async function listFormControlGesOptionsAction(): Promise<
  ActionResult<SelectOption[]>
> {
  return officeAction("documents.form_controls.ges_options", async ({ tenantId }) => {
    const options = await listGesOptions(tenantId);
    return options.map((g) => ({ value: g.id, label: g.name }));
  });
}

export async function listFormControlsAction(
  params: repo.ListFormControlsParams = {},
): Promise<ActionResult<Paginated<FormControlListItem>>> {
  return officeAction("documents.form_controls.list", ({ tenantId }) =>
    repo.listFormControls(tenantId, params),
  );
}

export async function getFormControlAction(
  id: string,
): Promise<ActionResult<FormControlDetail>> {
  return officeAction("documents.form_controls.get", async ({ tenantId }) => {
    const row = await repo.getFormControlById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createFormControlAction(
  input: FormControlInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "documents.form_controls.create",
    async ({ tenantId }) => {
      const data = formControlInputSchema.parse(input);
      const result = await repo.createFormControl(tenantId, data);
      revalidatePath(BASE);
      return result;
    },
    { audit: true },
  );
}

export async function updateFormControlAction(
  id: string,
  input: FormControlInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "documents.form_controls.update",
    async ({ tenantId }) => {
      const data = formControlInputSchema.parse(input);
      const ok = await repo.updateFormControl(tenantId, id, data);
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      revalidatePath(`${BASE}/${id}/edit`);
      return { id };
    },
    { audit: true },
  );
}

export async function deleteFormControlAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "documents.form_controls.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteFormControl(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE);
      return { id };
    },
    { audit: true },
  );
}
