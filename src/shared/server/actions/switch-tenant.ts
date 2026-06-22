"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

import { assertAuthenticated } from "@/shared/auth/require-auth";
import { listTenantMembershipsByUser } from "@/shared/db/repositories/org-memberships";
import { ACTIVE_ORG_COOKIE } from "@/shared/tenant/org-switch";
import { logTenantEvent } from "@/shared/tenant/audit-log";
import { ok, fail, type ActionResult } from "@/shared/server/result";

const ACTIVE_ORG_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: true,
  path: "/",
} as const;

/**
 * Troca o tenant ativo. O alvo é validado contra as memberships do usuário (o
 * tenant nunca vem de input cru do cliente — Princípio I); a seleção persiste no
 * cookie httpOnly, validado de novo em `selectActiveTenant` na leitura.
 */
export async function switchTenantAction(
  orgId: string,
): Promise<ActionResult<{ orgId: string }>> {
  const { userId } = assertAuthenticated(await auth());

  const memberships = await listTenantMembershipsByUser(userId);
  const isMember = memberships.some((membership) => membership.orgId === orgId);

  if (!isMember) {
    logTenantEvent("error", {
      operation: "tenant.org_switch",
      outcome: "blocked",
      userId,
      orgId,
    });
    return fail("FORBIDDEN", "Organização indisponível para troca.");
  }

  (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, ACTIVE_ORG_COOKIE_OPTIONS);
  logTenantEvent("info", {
    operation: "tenant.org_switched",
    outcome: "ok",
    userId,
    orgId,
  });

  revalidatePath("/", "layout");
  return ok({ orgId });
}
