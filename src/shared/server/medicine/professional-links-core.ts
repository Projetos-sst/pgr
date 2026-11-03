import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as repo from "@/shared/db/repositories/medico-user-links";
import * as invitations from "@/shared/db/repositories/medico-link-invitations";
import {
  professionalLinkSchema,
  professionalRevokeSchema,
} from "@/shared/domains/medicine/professional-links";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";

const medicoId = (id: string) => requiredUuid("Profissional inválido.").parse(id);

export function listLinks(ctx: TenantContext, id: string) {
  return repo.listMedicoUserLinks(ctx, medicoId(id));
}

const invitationId = (id: string) => requiredUuid("Convite inválido.").parse(id);

/**
 * NOB-157: o owner convida; o vínculo só nasce do aceite da própria conta convidada e, no
 * autovínculo, da aprovação de outra conta owner. Não há mais vínculo direto.
 */
export async function invite(ctx: TenantContext, id: string, input: unknown) {
  const medico = medicoId(id);
  return invitations.inviteMedicoUser(ctx, medico, professionalLinkSchema.parse(input));
}

export function listInvitations(ctx: TenantContext, id: string) {
  return invitations.listMedicoLinkInvitations(ctx, medicoId(id));
}

export function myPendingInvitations(ctx: TenantContext) {
  return invitations.listMyPendingInvitations(ctx);
}

export type InvitationAction = "accept" | "approve" | "decline" | "cancel" | "complete";

export function actOnInvitation(
  ctx: TenantContext,
  id: string,
  invitation: string,
  action: InvitationAction,
) {
  const medico = medicoId(id);
  const inv = invitationId(invitation);
  if (action === "accept")
    return invitations.acceptMedicoLinkInvitation(ctx, medico, inv);
  if (action === "approve")
    return invitations.approveMedicoLinkInvitation(ctx, medico, inv);
  if (action === "complete") return invitations.completeSelfInvitation(ctx, medico, inv);
  return invitations.closeMedicoLinkInvitation(
    ctx,
    medico,
    inv,
    action === "decline" ? "declined" : "cancelled",
  );
}

export function revoke(ctx: TenantContext, id: string, linkId: string, input: unknown) {
  return repo.revokeMedicoUserLink(
    ctx,
    medicoId(id),
    requiredUuid("Vínculo inválido.").parse(linkId),
    professionalRevokeSchema.parse(input),
  );
}

export function myProfile(ctx: TenantContext) {
  return repo.getActorProfessionalProfile(ctx);
}
