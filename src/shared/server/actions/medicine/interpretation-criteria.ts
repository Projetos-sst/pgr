"use server";
import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import {
  criteriaHistory,
  defineCriteria,
  listCriteria,
} from "@/shared/server/medicine/interpretation-criteria-core";

export async function listInterpretationCriteriaAction(companyId: string) {
  return officeAction("medicine.interpretation_criteria.list", (ctx) =>
    listCriteria(ctx, companyId),
  );
}

export async function interpretationCriteriaHistoryAction(
  companyId: string,
  code: string,
) {
  return officeAction("medicine.interpretation_criteria.history", (ctx) =>
    criteriaHistory(ctx, companyId, code),
  );
}

export async function defineInterpretationCriteriaAction(
  companyId: string,
  input: unknown,
) {
  return officeAction(
    "medicine.interpretation_criteria.define",
    async (ctx) => {
      const row = await defineCriteria(ctx, companyId, input);
      revalidatePath(`/companies/${companyId}/interpretation-criteria`);
      return row;
    },
    { audit: true },
  );
}
