"use server";
import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import {
  link,
  listLinks,
  myProfile,
  revoke,
} from "@/shared/server/medicine/professional-links-core";

export async function listMedicoUserLinksAction(medicoId: string) {
  return officeAction("medicine.professional_links.list", (ctx) =>
    listLinks(ctx, medicoId),
  );
}

export async function linkMedicoUserAction(medicoId: string, input: unknown) {
  return officeAction(
    "medicine.professional_links.link",
    async (ctx) => {
      const result = await link(ctx, medicoId, input);
      revalidatePath(`/medicos/${medicoId}/edit`);
      return result;
    },
    { audit: true },
  );
}

export async function revokeMedicoUserLinkAction(
  medicoId: string,
  linkId: string,
  input: unknown,
) {
  return officeAction(
    "medicine.professional_links.revoke",
    async (ctx) => {
      const result = await revoke(ctx, medicoId, linkId, input);
      revalidatePath(`/medicos/${medicoId}/edit`);
      return result;
    },
    { audit: true },
  );
}

export async function getMyProfessionalProfileAction() {
  return officeAction("medicine.professional_links.me", (ctx) => myProfile(ctx));
}
