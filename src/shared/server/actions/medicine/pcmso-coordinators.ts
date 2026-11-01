"use server";

import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/medicine/pcmso-coordinator-core";

const path = (companyId: string) => `/companies/${companyId}/pcmso-coordinator`;

export async function listPcmsoCoordinatorsAction(companyId: string) {
  return officeAction("medicine.pcmso_coordinators.list", (ctx) =>
    core.listCoordinators(ctx, companyId),
  );
}

export async function designatePcmsoCoordinatorAction(companyId: string, input: unknown) {
  return officeAction(
    "medicine.pcmso_coordinators.designate",
    async (ctx) => {
      const row = await core.designateCoordinator(ctx, companyId, input);
      revalidatePath(path(companyId));
      return row;
    },
    { audit: true },
  );
}

export async function closePcmsoCoordinatorAction(
  companyId: string,
  assignmentId: string,
  input: unknown,
) {
  return officeAction(
    "medicine.pcmso_coordinators.close",
    async (ctx) => {
      const row = await core.closeCoordinator(ctx, assignmentId, input);
      revalidatePath(path(companyId));
      return row;
    },
    { audit: true },
  );
}
