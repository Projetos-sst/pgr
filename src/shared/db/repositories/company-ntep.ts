import "server-only";
import { and, eq } from "drizzle-orm";

import { NotFoundError } from "@/shared/errors/not-found-error";

import { withOrg } from "../with-org";
import { companies } from "../schema/companies";
import { assertCompanyModuleTx } from "./company-modules";

/**
 * CNAE cadastrado da empresa do tenant, para consultar a Lista C (NOB-113). Exige Medicina
 * habilitada na empresa. Só dados cadastrais da empresa — nenhum dado de trabalhador.
 */
export async function getCompanyCnaeForNtep(orgId: string, companyId: string) {
  return withOrg(orgId, async (tx) => {
    const [company] = await tx
      .select({
        id: companies.id,
        razaoSocial: companies.razaoSocial,
        cnae: companies.cnae,
      })
      .from(companies)
      .where(and(eq(companies.orgId, orgId), eq(companies.id, companyId)))
      .limit(1);
    if (!company) throw new NotFoundError();
    await assertCompanyModuleTx(tx, orgId, company.id, "medicine");
    return company;
  });
}
