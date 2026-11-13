import "server-only";

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { runAsActor } from "@/shared/db/session-actor";
import { logTenantEvent } from "@/shared/tenant/audit-log";

import { toActionError } from "./action-error";
import { ok, type ActionResult } from "./result";

const BLOCKED_CODES = new Set(["FORBIDDEN", "NO_TENANT_CONTEXT", "UNAUTHORIZED"]);

/**
 * Runs a Server Action behind the office-staff gate (FR-065) with standardized
 * error mapping (FR-063). Unexpected errors are logged and rethrown (não
 * silenciar). Set `audit` for write operations (FR-064): success emits a
 * tenant-boundary audit event without PII; reads emit nothing on success.
 */
export async function officeAction<T>(
  operation: string,
  fn: (ctx: TenantContext) => Promise<T>,
  opts: { audit?: boolean; tenantAccess?: boolean } = {},
): Promise<ActionResult<T>> {
  let ctx: TenantContext | null = null;
  try {
    ctx = opts.tenantAccess
      ? await (
          await import("@/shared/auth/require-tenant-context")
        ).requireTenantContext()
      : await requireOfficeStaff();
    const resolved = ctx;
    const data = await runAsActor(resolved.userId, () => fn(resolved));
    if (opts.audit) {
      logTenantEvent("info", {
        operation,
        outcome: "ok",
        orgId: ctx.tenantId,
        userId: ctx.userId,
      });
    }
    return ok(data);
  } catch (error) {
    const mapped = toActionError(error);
    if (mapped) {
      logTenantEvent("info", {
        operation,
        outcome: BLOCKED_CODES.has(mapped.code) ? "blocked" : "rejected",
        orgId: ctx?.tenantId ?? null,
        userId: ctx?.userId ?? null,
      });
      return { ok: false, error: mapped };
    }
    logTenantEvent("error", {
      operation,
      outcome: "rejected",
      orgId: ctx?.tenantId ?? null,
      userId: ctx?.userId ?? null,
    });
    throw error;
  }
}
