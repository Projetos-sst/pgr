import "server-only";

import { ForbiddenError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as repo from "@/shared/db/repositories/member-access-scopes";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import {
  accessScopeGrantSchema,
  allowedAreas,
  type AccessArea,
  type AccessScopeView,
} from "@/shared/domains/platform/access-scopes";

function requireOwner(ctx: TenantContext): void {
  if (ctx.role !== "owner")
    throw new ForbiddenError("Somente o administrador configura os acessos da equipe.");
}

export async function listAccessScopes(
  ctx: TenantContext,
  userId: string,
): Promise<AccessScopeView[]> {
  if (ctx.role !== "owner" && ctx.userId !== userId)
    throw new ForbiddenError("Você só pode consultar os seus próprios acessos.");
  return repo.listMemberAccessScopes(ctx.tenantId, userId);
}

export async function grantAccessScope(
  ctx: TenantContext,
  userId: string,
  input: unknown,
): Promise<AccessScopeView> {
  requireOwner(ctx);
  const grant = accessScopeGrantSchema.parse(input);
  return repo.grantMemberAccessScope(ctx.tenantId, ctx.userId, userId, grant);
}

export async function revokeAccessScope(
  ctx: TenantContext,
  userId: string,
  scopeId: string,
): Promise<void> {
  requireOwner(ctx);
  const id = requiredUuid("Escopo inválido.").parse(scopeId);
  await repo.revokeMemberAccessScope(ctx.tenantId, ctx.userId, userId, id);
}

export async function getOwnAccessAreas(ctx: TenantContext): Promise<AccessArea[]> {
  const scopes = await repo.listMemberAccessScopes(ctx.tenantId, ctx.userId);
  return allowedAreas(ctx.role, scopes);
}
