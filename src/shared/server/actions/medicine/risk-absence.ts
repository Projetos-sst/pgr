"use server";
import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import {
  declareRiskAbsence,
  listRiskAbsence,
} from "@/shared/server/medicine/risk-absence-core";

export async function listRiskAbsenceAction(companyId: string) {
  return officeAction(
    "medicine.risk_absence.list",
    (ctx) => listRiskAbsence(ctx, companyId),
    { tenantAccess: true },
  );
}

export async function declareRiskAbsenceAction(companyId: string, input: unknown) {
  return officeAction(
    "medicine.risk_absence.declare",
    async (ctx) => {
      const row = await declareRiskAbsence(ctx, companyId, input);
      revalidatePath(`/companies/${companyId}/medical-risks`);
      return row;
    },
    { tenantAccess: true, audit: true },
  );
}
