import "server-only";

import { forbidden } from "next/navigation";

import { ForbiddenError } from "./errors";
import { requireOfficeStaff } from "./require-office-staff";
import type { TenantContext } from "./require-tenant-context";

/**
 * Page-level office-staff gate (Server Components). On `client` role, renders
 * the Next 16 `forbidden()` boundary (`app/forbidden.tsx`). Applies to reads
 * too — `client` is denied on every route of this slice (FR-065/SC-008).
 */
export async function requireOfficeStaffPage(): Promise<TenantContext> {
  try {
    return await requireOfficeStaff();
  } catch (error) {
    if (error instanceof ForbiddenError) forbidden();
    throw error;
  }
}
