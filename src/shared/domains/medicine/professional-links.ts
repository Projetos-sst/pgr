import { z } from "zod";

/**
 * Vínculo profissional ↔ conta de acesso (NOB-149). A conta precisa ser membro do escritório;
 * o profissional precisa estar ativo. Motivo obrigatório para vincular e para revogar.
 */
const reason = z
  .string()
  .trim()
  .min(10, "Descreva o motivo (mínimo de 10 caracteres).")
  .max(1000, "Máximo de 1000 caracteres.");

export const professionalLinkSchema = z
  .object({
    userId: z.string().trim().min(1, "Selecione a conta.").max(200, "Conta inválida."),
    reason,
  })
  .strict();
export type ProfessionalLinkValues = z.infer<typeof professionalLinkSchema>;

export const professionalRevokeSchema = z.object({ reason }).strict();
export type ProfessionalRevokeValues = z.infer<typeof professionalRevokeSchema>;

// ── Convite e aceite (NOB-157) ───────────────────────────────────────────────

export type InvitationEventKind = "accepted" | "declined" | "approved" | "cancelled";

export type InvitationStatus =
  | "pending_acceptance"
  | "pending_approval"
  | "linked"
  | "declined"
  | "cancelled"
  | "expired";

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  pending_acceptance: "Aguardando o aceite da conta convidada",
  pending_approval: "Autovínculo aceito: aguardando a aprovação de outro responsável",
  linked: "Aceito: vínculo criado",
  declined: "Recusado pela conta convidada",
  cancelled: "Cancelado",
  expired: "Expirado sem aceite",
};

/**
 * Situação do convite a partir dos eventos. O vínculo efetivo só existe com aceite da própria
 * conta e, no autovínculo, com a aprovação de outra conta owner.
 */
export function invitationStatus(input: {
  kinds: ReadonlySet<InvitationEventKind>;
  linked: boolean;
  selfInvitation: boolean;
  expired: boolean;
}): InvitationStatus {
  if (input.linked) return "linked";
  if (input.kinds.has("cancelled")) return "cancelled";
  if (input.kinds.has("declined")) return "declined";
  if (input.expired) return "expired";
  if (input.kinds.has("accepted"))
    return input.selfInvitation && !input.kinds.has("approved")
      ? "pending_approval"
      : "linked";
  return "pending_acceptance";
}

/**
 * Declaração que a conta assina ao aceitar: identidade do cadastro, autenticada pelo login. Não é
 * verificação do conselho profissional, que o sistema ainda não faz.
 */
export function identityStatement(medico: {
  name: string;
  registration: string;
}): string {
  return `Declaro, com meu login, que sou ${medico.name}, ${medico.registration}, e que assumo o acesso profissional vinculado a este cadastro.`;
}

export type InvitationView = {
  id: string;
  medicoId: string;
  userId: string;
  reason: string;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  selfInvitation: boolean;
  status: InvitationStatus;
  events: { kind: InvitationEventKind; actorUserId: string; occurredAt: string }[];
};
