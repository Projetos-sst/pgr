import "server-only";
import { and, eq } from "drizzle-orm";
import { ForbiddenError } from "@/shared/auth/errors";
import { NotFoundError } from "@/shared/errors/not-found-error";
import {
  COMPANY_MODULES,
  type CompanyModule,
  type CompanyModuleView,
} from "@/shared/domains/platform/company-modules";
import { withOrg, type TenantTransaction } from "../with-org";
import { companies } from "../schema/companies";
import { companyModules } from "../schema/company-modules";

export async function assertCompanyModuleTx(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
  module: CompanyModule,
): Promise<void> {
  const [enabled] = await tx
    .select({ id: companyModules.id })
    .from(companyModules)
    .where(
      and(
        eq(companyModules.orgId, orgId),
        eq(companyModules.companyId, companyId),
        eq(companyModules.module, module),
        eq(companyModules.enabled, true),
      ),
    )
    .limit(1);
  if (!enabled) throw new ForbiddenError("Serviço não habilitado para esta empresa.");
}

export async function getCompanyModules(
  orgId: string,
  companyId: string,
): Promise<CompanyModuleView[]> {
  return withOrg(orgId, async (tx) => {
    const [company] = await tx
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
      .limit(1);
    if (!company) throw new NotFoundError();
    const rows = await tx
      .select()
      .from(companyModules)
      .where(
        and(eq(companyModules.orgId, orgId), eq(companyModules.companyId, companyId)),
      );
    return COMPANY_MODULES.map((module) => ({
      module,
      enabled: rows.some((row) => row.module === module && row.enabled),
    }));
  });
}
