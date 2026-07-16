"use server";

import { revalidatePath } from "next/cache";

import { listCompanyOptions } from "@/shared/db/repositories/companies";
import * as repo from "@/shared/db/repositories/work-permits";
import {
  workPermitInputSchema,
  type WorkPermitDetail,
  type WorkPermitInput,
  type WorkPermitListItem,
} from "@/shared/domains/work-permits/work-permits";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";

const BASE = "/permissoes-trabalho";

export type CompanyOption = { value: string; label: string };

export async function listWorkPermitCompanyOptionsAction(): Promise<
  ActionResult<CompanyOption[]>
> {
  return officeAction("work_permits.company_options", async ({ tenantId }) => {
    const options = await listCompanyOptions(tenantId);
    return options.map((c) => ({ value: c.id, label: c.razaoSocial }));
  });
}

export async function listWorkPermitsAction(
  params: repo.ListWorkPermitsParams = {},
): Promise<ActionResult<Paginated<WorkPermitListItem>>> {
  return officeAction("work_permits.list", ({ tenantId }) =>
    repo.listWorkPermits(tenantId, params),
  );
}

export async function getWorkPermitAction(
  id: string,
): Promise<ActionResult<WorkPermitDetail>> {
  return officeAction("work_permits.get", async ({ tenantId }) => {
    const row = await repo.getWorkPermit(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createWorkPermitAction(
  input: WorkPermitInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "work_permits.create",
    async ({ tenantId }) => {
      const result = await repo.createWorkPermit(
        tenantId,
        workPermitInputSchema.parse(input),
      );
      revalidatePath(BASE);
      return result;
    },
    { audit: true },
  );
}

export async function updateWorkPermitAction(
  id: string,
  input: WorkPermitInput,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "work_permits.update",
    async ({ tenantId }) => {
      const ok = await repo.updateWorkPermit(
        tenantId,
        id,
        workPermitInputSchema.parse(input),
      );
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { id };
    },
    { audit: true },
  );
}

export async function deleteWorkPermitAction(
  id: string,
): Promise<ActionResult<{ deleted: true }>> {
  return officeAction(
    "work_permits.delete",
    async ({ tenantId }) => {
      const ok = await repo.deleteWorkPermit(tenantId, id);
      if (!ok) throw new NotFoundError();
      revalidatePath(BASE);
      return { deleted: true as const };
    },
    { audit: true },
  );
}
