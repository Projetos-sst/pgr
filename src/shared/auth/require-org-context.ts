import "server-only";

import { auth } from "@clerk/nextjs/server";

import { NoActiveOrgError } from "./errors";
import { assertAuthenticated } from "./require-auth";
import type { OrgAuthContext } from "./types";

export async function requireOrgContext(): Promise<OrgAuthContext> {
  const session = await auth();
  const { userId, sessionId } = assertAuthenticated(session);

  if (!session.orgId) {
    throw new NoActiveOrgError();
  }

  return {
    userId,
    sessionId,
    orgId: session.orgId,
    orgRole: session.orgRole ?? null,
    orgSlug: session.orgSlug ?? null,
  };
}
