"use server";
import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import {
  actOnInvitation,
  invite,
  listInvitations,
  listLinks,
  myPendingInvitations,
  myProfile,
  revoke,
  type InvitationAction,
} from "@/shared/server/medicine/professional-links-core";

export async function listMedicoUserLinksAction(medicoId: string) {
  return officeAction("medicine.professional_links.list", (ctx) =>
    listLinks(ctx, medicoId),
  );
}

export async function inviteMedicoUserAction(medicoId: string, input: unknown) {
  return officeAction(
    "medicine.professional_links.invite",
    async (ctx) => {
      const result = await invite(ctx, medicoId, input);
      revalidatePath(`/medicos/${medicoId}/edit`);
      return result;
    },
    { audit: true },
  );
}

export async function listMedicoLinkInvitationsAction(medicoId: string) {
  return officeAction("medicine.professional_links.invitations", (ctx) =>
    listInvitations(ctx, medicoId),
  );
}

export async function listMyProfessionalInvitationsAction() {
  return officeAction(
    "medicine.professional_links.my_invitations",
    (ctx) => myPendingInvitations(ctx),
    { tenantAccess: true },
  );
}

// Aceitar/recusar valem para qualquer conta do escritório convidada (a regra real é "a própria
// conta"); aprovar e cancelar exigem owner no repositório e na RLS.
export async function actOnMedicoLinkInvitationAction(
  medicoId: string,
  invitationId: string,
  action: InvitationAction,
) {
  return officeAction(
    `medicine.professional_links.${action}`,
    async (ctx) => {
      const result = await actOnInvitation(ctx, medicoId, invitationId, action);
      revalidatePath(`/medicos/${medicoId}/edit`);
      return result;
    },
    { audit: true, tenantAccess: true },
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
