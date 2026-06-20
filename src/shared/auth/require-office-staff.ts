import "server-only";

import { ForbiddenError } from "./errors";
import { requireTenantContext, type TenantContext } from "./require-tenant-context";

const OFFICE_STAFF_ROLES = new Set(["owner", "collaborator"]);

export async function requireOfficeStaff(): Promise<TenantContext> {
  const ctx = await requireTenantContext();
  if (!OFFICE_STAFF_ROLES.has(ctx.role)) {
    throw new ForbiddenError();
  }
  return ctx;
}
