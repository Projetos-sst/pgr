"use server";

import { revalidatePath } from "next/cache";

import type {
  AccessArea,
  AccessScopeGrant,
  AccessScopeView,
} from "@/shared/domains/platform/access-scopes";
import { officeAction } from "@/shared/server/office-action";
import {
  getOwnAccessAreas,
  grantAccessScope,
  listAccessScopes,
  revokeAccessScope,
} from "@/shared/server/platform/access-scope-core";
import type { ActionResult } from "@/shared/server/result";

export async function listAccessScopesAction(
  userId: string,
): Promise<ActionResult<AccessScopeView[]>> {
  return officeAction(
    "platform.access_scopes.list",
    (ctx) => listAccessScopes(ctx, userId),
    { tenantAccess: true },
  );
}

export async function getOwnAccessAreasAction(): Promise<ActionResult<AccessArea[]>> {
  return officeAction("platform.access_scopes.own_areas", getOwnAccessAreas, {
    tenantAccess: true,
  });
}

export async function grantAccessScopeAction(
  userId: string,
  input: AccessScopeGrant,
): Promise<ActionResult<AccessScopeView>> {
  return officeAction(
    "platform.access_scopes.grant",
    async (ctx) => {
      const scope = await grantAccessScope(ctx, userId, input);
      revalidatePath("/", "layout");
      return scope;
    },
    { audit: true },
  );
}

export async function revokeAccessScopeAction(
  userId: string,
  scopeId: string,
): Promise<ActionResult<{ revoked: true }>> {
  return officeAction(
    "platform.access_scopes.revoke",
    async (ctx) => {
      await revokeAccessScope(ctx, userId, scopeId);
      revalidatePath("/", "layout");
      const revoked: { revoked: true } = { revoked: true };
      return revoked;
    },
    { audit: true },
  );
}
