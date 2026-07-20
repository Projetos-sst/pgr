import "server-only";

import { ForbiddenError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as membershipsRepo from "@/shared/db/repositories/org-memberships";
import * as orgsRepo from "@/shared/db/repositories/orgs";
import {
  inviteMemberSchema,
  toTeamMemberView,
  updateMemberRoleSchema,
  type InviteMemberInput,
  type TeamMemberView,
  type UpdateMemberRoleValues,
} from "@/shared/domains/platform/team";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { isTeamManagementAvailable } from "@/shared/tenant/plan";
import { toDomainRole } from "@/shared/tenant/roles";
import * as clerkOrg from "@/shared/integrations/clerk/organizations";
import { resolvePageParams, type Paginated } from "@/shared/pagination";

function requireOwner(ctx: TenantContext): void {
  if (ctx.role !== "owner") {
    throw new ForbiddenError("Apenas o administrador gerencia a equipe.");
  }
}

/**
 * Multiusuário é um recurso PRO (Modelo B: conta free não tem Clerk org). Retorna
 * o `clerk_org_id` do tenant ativo ou barra a operação de escrita de equipe.
 */
async function requireClerkBackedTeam(ctx: TenantContext): Promise<string> {
  if (!isTeamManagementAvailable(ctx.plan)) {
    throw new ForbiddenError("Gestão de equipe disponível apenas no plano Pro.");
  }
  const org = await orgsRepo.getOrgById(ctx.tenantId);
  if (!org?.clerkOrgId) {
    throw new ForbiddenError("Organização sem espaço multiusuário.");
  }
  return org.clerkOrgId;
}

export async function listTeam(
  ctx: TenantContext,
  params: { search?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<TeamMemberView>> {
  const { page, pageSize } = resolvePageParams(params);
  const { rows, total } = await membershipsRepo.listMembershipsByOrg(ctx.tenantId, {
    search: params.search,
    page,
    pageSize,
  });
  return { rows: rows.map(toTeamMemberView), total };
}

export async function inviteTeamMember(
  ctx: TenantContext,
  input: InviteMemberInput,
): Promise<{ email: string; role: string }> {
  requireOwner(ctx);
  const values = inviteMemberSchema.parse(input);
  const clerkOrgId = await requireClerkBackedTeam(ctx);
  await clerkOrg.createOrgInvitation({
    clerkOrgId,
    inviterUserId: ctx.userId,
    email: values.email,
    role: values.role,
  });
  return { email: values.email, role: values.role };
}

export async function updateTeamMemberRole(
  ctx: TenantContext,
  targetUserId: string,
  input: UpdateMemberRoleValues,
): Promise<{ userId: string; role: string }> {
  requireOwner(ctx);
  const values = updateMemberRoleSchema.parse(input);
  const clerkOrgId = await requireClerkBackedTeam(ctx);

  const membership = await membershipsRepo.getOrgMembership({
    orgId: ctx.tenantId,
    userId: targetUserId,
  });
  if (!membership) throw new NotFoundError();

  // Proteção: não rebaixar o último administrador da organização. `membership.role`
  // é o valor cru gravado no espelho local (`org:admin` em orgs Clerk-backed) —
  // normalizar antes de comparar, senão a checagem nunca dispara para essas orgs.
  if (toDomainRole(membership.role) === "owner" && values.role !== "owner") {
    const owners = await membershipsRepo.countOwnersByOrg(ctx.tenantId);
    if (owners <= 1) {
      throw new ForbiddenError("Não é possível rebaixar o último administrador.");
    }
  }

  await clerkOrg.updateOrgMembershipRole({
    clerkOrgId,
    userId: targetUserId,
    role: values.role,
  });
  return { userId: targetUserId, role: values.role };
}

export async function removeTeamMember(
  ctx: TenantContext,
  targetUserId: string,
): Promise<void> {
  requireOwner(ctx);
  const clerkOrgId = await requireClerkBackedTeam(ctx);

  if (targetUserId === ctx.userId) {
    throw new ForbiddenError("Você não pode remover a si mesmo da equipe.");
  }

  const membership = await membershipsRepo.getOrgMembership({
    orgId: ctx.tenantId,
    userId: targetUserId,
  });
  if (!membership) throw new NotFoundError();

  // Proteção: não remover o último administrador (mesmo cuidado de normalização
  // do `updateTeamMemberRole` acima).
  if (toDomainRole(membership.role) === "owner") {
    const owners = await membershipsRepo.countOwnersByOrg(ctx.tenantId);
    if (owners <= 1) {
      throw new ForbiddenError("Não é possível remover o último administrador.");
    }
  }

  await clerkOrg.removeOrgMembership({ clerkOrgId, userId: targetUserId });
}
