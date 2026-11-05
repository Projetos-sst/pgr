"use server";
import { officeAction } from "@/shared/server/office-action";
import { companyNtep, lookupNtepCatalog } from "@/shared/server/medicine/ntep-core";

/** Lista C (NTEP): consulta por CID-10 e/ou classe CNAE. Só leitura, informativa (NOB-113). */
export async function lookupNtepAction(input: {
  cid?: string | null;
  cnae?: string | null;
  version?: string | null;
}) {
  return officeAction("medicine.ntep.lookup", async () => lookupNtepCatalog(input));
}

/** Lista C para a classe CNAE cadastrada da empresa (exige Medicina habilitada). */
export async function getCompanyNtepAction(companyId: string) {
  return officeAction("medicine.ntep.company", (ctx) => companyNtep(ctx, companyId));
}
