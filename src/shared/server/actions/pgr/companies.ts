"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  companyInputSchema,
  type CompanyInput,
  type CompanyListItem,
} from "@/shared/domains/pgr/companies";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/companies";
import type { Company } from "@/shared/db/schema";

const BASE_PATH = "/companies";

export async function listCompaniesAction(
  params: repo.ListCompaniesParams = {},
): Promise<ActionResult<Paginated<CompanyListItem>>> {
  return officeAction("pgr.companies.list", ({ tenantId }) =>
    repo.listCompanies(tenantId, params),
  );
}

export async function listCompanyOptionsAction(): Promise<
  ActionResult<repo.CompanyOption[]>
> {
  return officeAction("pgr.companies.options", ({ tenantId }) =>
    repo.listCompanyOptions(tenantId),
  );
}

export async function getCompanyAction(id: string): Promise<ActionResult<Company>> {
  return officeAction("pgr.companies.get", async ({ tenantId }) => {
    const company = await repo.getCompanyById(tenantId, id);
    if (!company) throw new NotFoundError();
    return company;
  });
}

export async function createCompanyAction(
  input: CompanyInput,
): Promise<ActionResult<Company>> {
  return officeAction(
    "pgr.companies.create",
    async ({ tenantId }) => {
      const data = companyInputSchema.parse(input);
      const company = await repo.createCompany(tenantId, data);
      revalidatePath(BASE_PATH);
      return company;
    },
    { audit: true },
  );
}

export async function updateCompanyAction(
  id: string,
  input: CompanyInput,
): Promise<ActionResult<Company>> {
  return officeAction(
    "pgr.companies.update",
    async ({ tenantId }) => {
      const data = companyInputSchema.parse(input);
      const company = await repo.updateCompany(tenantId, id, data);
      if (!company) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      revalidatePath(`${BASE_PATH}/${id}/edit`);
      return company;
    },
    { audit: true },
  );
}

export async function deleteCompanyAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.companies.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteCompany(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidatePath(BASE_PATH);
      return { id };
    },
    { audit: true },
  );
}

export async function getCompanyDependentsAction(
  id: string,
): Promise<ActionResult<repo.CompanyDependents>> {
  return officeAction("pgr.companies.dependents", ({ tenantId }) =>
    repo.countCompanyDependents(tenantId, id),
  );
}
