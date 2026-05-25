"use server";

import { requireOrgContext } from "@/lib/auth/require-org-context";
import { NoActiveOrgError, UnauthorizedError } from "@/lib/auth/errors";

export type WhoamiResult =
  | { ok: true; userId: string; orgId: string }
  | { ok: false; error: "UNAUTHORIZED" | "NO_ACTIVE_ORG" };

export async function whoamiAction(): Promise<WhoamiResult> {
  try {
    const ctx = await requireOrgContext();
    return { ok: true, userId: ctx.userId, orgId: ctx.orgId };
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: "UNAUTHORIZED" };
    if (err instanceof NoActiveOrgError) return { ok: false, error: "NO_ACTIVE_ORG" };
    throw err;
  }
}
