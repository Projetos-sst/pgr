"use server";
import { revalidatePath } from "next/cache";
import { officeAction } from "@/shared/server/office-action";
import {
  getMedicalRiskInventory,
  registerMedicalRiskSource,
} from "@/shared/server/medicine/risk-source-core";
import type { MedicalSourceInput } from "@/shared/domains/medicine/risk-sources";
import type { PageParams } from "@/shared/pagination";

export async function getMedicalRiskInventoryAction(
  companyId: string,
  page: PageParams = {},
) {
  return officeAction("medicine.risk_sources.list", (ctx) =>
    getMedicalRiskInventory(ctx, companyId, page),
  );
}
export async function registerMedicalRiskSourceAction(
  companyId: string,
  input: MedicalSourceInput,
) {
  return officeAction(
    "medicine.risk_sources.register",
    async (ctx) => {
      const result = await registerMedicalRiskSource(ctx, companyId, input);
      revalidatePath(`/companies/${companyId}/medical-risks`);
      return result;
    },
    { audit: true },
  );
}
