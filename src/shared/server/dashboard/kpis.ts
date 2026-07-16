import "server-only";

import { listCompanies } from "@/shared/db/repositories/companies";
import { countEpiStockBelowMinimum } from "@/shared/db/repositories/epi-stock";
import { listEmployees } from "@/shared/db/repositories/employees";
import { listPgr } from "@/shared/db/repositories/pgr";

export type DashboardKpis = {
  companies: number;
  pgrs: number;
  employees: number;
  epiBelowMinimum: number;
};

/**
 * Agrega as 4 contagens dos KPIs do dashboard, todas escopadas pelo `orgId` do
 * tenant ativo (nunca de input do cliente). Cada leitura passa por `withOrg` +
 * RLS backstop nos repositórios — o isolamento entre tenants é provado por teste
 * de integração (Postgres efêmero).
 */
export async function getDashboardKpis(orgId: string): Promise<DashboardKpis> {
  const [companies, pgrs, employees, epiBelowMinimum] = await Promise.all([
    listCompanies(orgId).then((result) => result.total),
    listPgr(orgId).then((result) => result.total),
    listEmployees(orgId).then((result) => result.total),
    countEpiStockBelowMinimum(orgId),
  ]);

  return { companies, pgrs, employees, epiBelowMinimum };
}
