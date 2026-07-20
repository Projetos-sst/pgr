import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

import type { AssignableRole } from "@/shared/domains/platform/team";

// Papel de domínio → papel de organização do Clerk. Clerk usa org:admin/org:member;
// owner é admin, os demais são member (a granularidade fina fica no domínio local).
function toClerkOrgRole(role: AssignableRole): string {
  return role === "owner" ? "org:admin" : "org:member";
}

/**
 * Ponto ÚNICO de rede da gestão de equipe. Para tenants PRO (com `clerk_org_id`),
 * o Clerk é a fonte da verdade de membros; o `org_memberships` local é um espelho
 * sincronizado por webhook. Estas funções são isoladas para serem mockadas nos testes.
 */
export async function createOrgInvitation(args: {
  clerkOrgId: string;
  inviterUserId: string;
  email: string;
  role: AssignableRole;
}): Promise<void> {
  const client = await clerkClient();
  await client.organizations.createOrganizationInvitation({
    organizationId: args.clerkOrgId,
    inviterUserId: args.inviterUserId,
    emailAddress: args.email,
    role: toClerkOrgRole(args.role),
  });
}

export async function updateOrgMembershipRole(args: {
  clerkOrgId: string;
  userId: string;
  role: AssignableRole;
}): Promise<void> {
  const client = await clerkClient();
  await client.organizations.updateOrganizationMembership({
    organizationId: args.clerkOrgId,
    userId: args.userId,
    role: toClerkOrgRole(args.role),
  });
}

export async function removeOrgMembership(args: {
  clerkOrgId: string;
  userId: string;
}): Promise<void> {
  const client = await clerkClient();
  await client.organizations.deleteOrganizationMembership({
    organizationId: args.clerkOrgId,
    userId: args.userId,
  });
}
