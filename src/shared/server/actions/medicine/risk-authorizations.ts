"use server";
import { revalidatePath } from "next/cache";
import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/medicine/risk-authorization-core";
import { listRiskAuthorizationCompanies } from "@/shared/db/repositories/risk-authorizations";
import type { PageParams } from "@/shared/pagination";
export async function listRiskAuthorizationCompaniesAction(page: PageParams = {}) {
  return officeAction(
    "medicine.risk_authorizations.list",
    (ctx) => listRiskAuthorizationCompanies(ctx, page),
    { tenantAccess: true },
  );
}
export async function getRiskAuthorizationWorkspaceAction(
  companyId: string,
  page: PageParams = {},
) {
  return officeAction(
    "medicine.risk_authorizations.workspace",
    (ctx) => core.riskAuthorizationWorkspace(ctx, companyId, page),
    { tenantAccess: true },
  );
}
export async function appointCompanyAuthorizerAction(companyId: string, input: unknown) {
  return officeAction(
    "medicine.risk_authorizations.appoint",
    async (ctx) => {
      const result = await core.appointCompanyAuthorizer(ctx, companyId, input);
      revalidatePath(`/risk-authorizations/${companyId}`);
      return result;
    },
    { tenantAccess: true, audit: true },
  );
}
export async function authorizeCompanyProfessionalAction(
  companyId: string,
  input: unknown,
) {
  return officeAction(
    "medicine.risk_authorizations.professional",
    async (ctx) => {
      const result = await core.authorizeCompanyProfessional(ctx, companyId, input);
      revalidatePath(`/risk-authorizations/${companyId}`);
      return result;
    },
    { tenantAccess: true, audit: true },
  );
}
export async function decideCompanyRiskAction(
  companyId: string,
  entryId: string,
  input: unknown,
) {
  return officeAction(
    "medicine.risk_authorizations.review",
    async (ctx) => {
      const result = await core.decideCompanyRisk(ctx, companyId, entryId, input);
      revalidatePath(`/risk-authorizations/${companyId}`);
      revalidatePath(`/companies/${companyId}/medical-risks`);
      return result;
    },
    { tenantAccess: true, audit: true },
  );
}
