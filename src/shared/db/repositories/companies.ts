import "server-only";

import { withOrg } from "@/shared/db/with-org";
import { companies, type Company } from "@/shared/db/schema";

export type NewCompanyInput = {
  cnpj?: string | null;
  razaoSocial: string;
};

export async function listCompanies(tenantId: string): Promise<Company[]> {
  return withOrg(tenantId, async (tx) => tx.select().from(companies));
}

export async function createCompany(
  tenantId: string,
  input: NewCompanyInput,
): Promise<Company> {
  return withOrg(tenantId, async (tx) => {
    const [row] = await tx
      .insert(companies)
      .values({
        orgId: tenantId,
        cnpj: input.cnpj ?? null,
        razaoSocial: input.razaoSocial,
      })
      .returning();
    return row;
  });
}
