"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  companyInputSchema,
  type CompanyInput,
  type CompanyListItem,
} from "@/shared/domains/pgr/companies";
import { validateLogoFile } from "@/shared/domains/pgr/company-logo";
import type { Paginated } from "@/shared/pagination";
import * as repo from "@/shared/db/repositories/companies";
import type { Company } from "@/shared/db/schema";
import {
  getSignedCompanyLogoUrl,
  putCompanyLogo,
} from "@/shared/integrations/storage/company-logo-storage";

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

export type UploadCompanyLogoResult = { storagePath: string; url: string };

/**
 * Envia o arquivo de logo ao Storage e devolve o path (persistido em
 * `logoPath` no create/update do form) + uma URL assinada para preview
 * imediato no formulário (issue #4). Não toca o registro de `companies` —
 * quem persiste o path é `createCompanyAction`/`updateCompanyAction`, como
 * qualquer outro campo do formulário.
 */
export async function uploadCompanyLogoAction(
  formData: FormData,
): Promise<ActionResult<UploadCompanyLogoResult>> {
  return officeAction("pgr.companies.upload_logo", async ({ tenantId }) => {
    const raw = formData.get("file");
    const file = raw instanceof File ? raw : null;
    const check = validateLogoFile(file);
    if (!check.ok) throw new ValidationError(check.message);

    const stored = await putCompanyLogo(tenantId, file!, check.extension);
    const url = await getSignedCompanyLogoUrl(stored.storagePath);
    return { storagePath: stored.storagePath, url };
  });
}

export async function getCompanyDependentsAction(
  id: string,
): Promise<ActionResult<repo.CompanyDependents>> {
  return officeAction("pgr.companies.dependents", ({ tenantId }) =>
    repo.countCompanyDependents(tenantId, id),
  );
}
