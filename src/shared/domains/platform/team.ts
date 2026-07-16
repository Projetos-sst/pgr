import { z } from "zod";

import type { TeamMemberRow } from "@/shared/db/repositories/org-memberships";

// Papéis de domínio atribuíveis a um membro (espelham DOMAIN_ROLES do active-tenant).
export const assignableRoleSchema = z.enum(["owner", "collaborator", "client"]);
export type AssignableRole = z.infer<typeof assignableRoleSchema>;

export const ROLE_LABEL: Record<AssignableRole, string> = {
  owner: "Administrador",
  collaborator: "Colaborador",
  client: "Cliente",
};

export const inviteMemberSchema = z.object({
  email: z.email("E-mail inválido"),
  role: assignableRoleSchema,
});
export type InviteMemberInput = z.input<typeof inviteMemberSchema>;
export type InviteMemberValues = z.output<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: assignableRoleSchema,
});
export type UpdateMemberRoleValues = z.output<typeof updateMemberRoleSchema>;

export type TeamMemberView = {
  userId: string;
  role: string;
  roleLabel: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
  jobTitle: string | null;
};

export function toTeamMemberView(row: TeamMemberRow): TeamMemberView {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
  return {
    userId: row.userId,
    role: row.role,
    roleLabel: ROLE_LABEL[row.role as AssignableRole] ?? "Membro",
    name: name || row.email || "Sem nome",
    email: row.email,
    imageUrl: row.imageUrl,
    jobTitle: row.jobTitle,
  };
}
