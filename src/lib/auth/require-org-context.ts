import "server-only";

import { auth } from "@clerk/nextjs/server";

import { NoActiveOrgError, UnauthorizedError } from "./errors";
import type { OrgAuthContext } from "./types";

export async function requireOrgContext(): Promise<OrgAuthContext> {
  const session = await auth();
  const userId = session.userId;
  const sessionId = session.sessionId;

  if (!session.isAuthenticated || !userId || !sessionId) {
    throw new UnauthorizedError();
  }

  const orgId = session.orgId;
  if (!orgId) {
    throw new NoActiveOrgError();
  }

  return {
    userId,
    sessionId,
    orgId,
    orgRole: session.orgRole ?? null,
    orgSlug: session.orgSlug ?? null,
  };
}
