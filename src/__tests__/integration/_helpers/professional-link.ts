import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  actOnInvitation,
  invite,
  listLinks,
} from "@/shared/server/medicine/professional-links-core";

/**
 * Vínculo profissional ↔ conta pelo fluxo real da NOB-157: o owner convida e a própria conta
 * convidada aceita. Para autovínculo, `approver` (outro owner) aprova depois do aceite.
 * Devolve o vínculo efetivo.
 */
export async function linkByInvitation(
  owner: TenantContext,
  medicoId: string,
  input: { userId: string; reason: string },
  approver?: TenantContext,
) {
  const invitation = await invite(owner, medicoId, input);
  const invitee: TenantContext = { ...owner, userId: input.userId, role: "collaborator" };
  if (input.userId === owner.userId) invitee.role = owner.role;
  await actOnInvitation(invitee, medicoId, invitation.id, "accept");
  if (approver) await actOnInvitation(approver, medicoId, invitation.id, "approve");
  // Devolve o vínculo efetivo criado (o aberto mais recente do profissional).
  const open = (await listLinks(owner, medicoId)).find((l) => l.revokedAt === null);
  if (!open)
    throw new Error("Convite aceito sem vínculo efetivo (autovínculo sem aprovação?).");
  return open;
}
