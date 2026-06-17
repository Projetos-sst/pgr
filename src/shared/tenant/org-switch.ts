import { logTenantEvent } from "./audit-log";

export const ACTIVE_ORG_COOKIE = "tenant_active_org";

type ReconcileInput = {
  activeOrgId: string | null;
  lastSeenOrgId: string | null;
  userId?: string | null;
  requestId?: string;
};

type ReconcileResult = {
  switched: boolean;
  nextCookieValue: string | null;
};

export function reconcileActiveOrg(input: ReconcileInput): ReconcileResult {
  const { activeOrgId, lastSeenOrgId, userId, requestId } = input;
  const switched =
    activeOrgId !== null && lastSeenOrgId !== null && activeOrgId !== lastSeenOrgId;

  if (switched) {
    logTenantEvent("info", {
      operation: "tenant.org_switched",
      outcome: "ok",
      orgId: activeOrgId,
      userId: userId ?? null,
      requestId,
    });
  }

  return { switched, nextCookieValue: activeOrgId };
}
