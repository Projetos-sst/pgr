import "server-only";

import { auth } from "@clerk/nextjs/server";

import { UnauthorizedError } from "./errors";
import type { AuthContext } from "./types";

type ClerkSession = Awaited<ReturnType<typeof auth>>;

export async function requireAuth(): Promise<AuthContext> {
  return assertAuthenticated(await auth());
}

export function assertAuthenticated(session: ClerkSession): AuthContext {
  if (!session.isAuthenticated || !session.userId || !session.sessionId) {
    throw new UnauthorizedError();
  }
  return { userId: session.userId, sessionId: session.sessionId };
}
