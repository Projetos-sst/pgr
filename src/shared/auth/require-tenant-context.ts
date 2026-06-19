import "server-only";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

import { ACTIVE_ORG_COOKIE } from "@/shared/tenant/org-switch";
import { logTenantEvent } from "@/shared/tenant/audit-log";
import { resolveActiveTenant, type Plan } from "@/shared/tenant/active-tenant";

import { NoTenantContextError } from "./errors";
import { assertAuthenticated } from "./require-auth";

export type TenantContext = {
  userId: string;
  tenantId: string;
  plan: Plan;
  role: string;
};

export async function requireTenantContext(): Promise<TenantContext> {
  const { userId } = assertAuthenticated(await auth());

  const cookieTenantId = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value ?? null;
  const active = await resolveActiveTenant(userId, cookieTenantId);

  if (!active) {
    logTenantEvent("error", {
      operation: "tenant.context",
      outcome: "blocked",
      userId,
    });
    throw new NoTenantContextError();
  }

  return {
    userId,
    tenantId: active.tenantId,
    plan: active.plan,
    role: active.role,
  };
}
