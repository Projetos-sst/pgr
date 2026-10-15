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
    // O evento de auditoria do bloqueio continua obrigatório (FR-026) e sai com
    // a mesma operação/outcome de sempre. O que muda é a severidade, porque os
    // dois estados que caem aqui não têm a mesma gravidade:
    //
    //  - `lost_access`: havia um tenant selecionado no cookie e ele não resolve
    //    mais — é o cenário da FR-024 (perda de acesso ao tenant ativo). Segue
    //    em `error`, que é o sinal que a auditoria quer ver.
    //  - `no_membership`: nunca houve seleção; é conta autenticada ainda sem
    //    organização (primeiro acesso, provisionamento que não pegou, convite
    //    pendente). É estado de onboarding, tratado por `/no-organization` —
    //    registrá-lo como `error` transformava fluxo esperado em alarme e, em
    //    desenvolvimento, em overlay de stack trace na cara do usuário.
    //
    // Falha de infraestrutura NÃO passa por aqui: `resolveActiveTenant` lança, o
    // erro sobe e continua barulhento.
    const lostAccess = cookieTenantId !== null;
    logTenantEvent(lostAccess ? "error" : "info", {
      operation: "tenant.context",
      outcome: "blocked",
      userId,
      reason: lostAccess ? "lost_access" : "no_membership",
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
