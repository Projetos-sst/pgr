"use server";
import { officeAction } from "@/shared/server/office-action";
import { getPcmsoReadiness } from "@/shared/server/medicine/pcmso-readiness-core";

export async function getPcmsoReadinessAction(companyId: string) {
  return officeAction("medicine.pcmso_readiness.get", (ctx) =>
    getPcmsoReadiness(ctx, companyId),
  );
}
