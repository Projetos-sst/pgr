import "server-only";

import { auth } from "@clerk/nextjs/server";

import { UnauthorizedError } from "./errors";
import type { AuthContext } from "./types";

export async function requireAuth(): Promise<AuthContext> {
  const session = await auth();
  const userId = session.userId;
  const sessionId = session.sessionId;

  if (!session.isAuthenticated || !userId || !sessionId) {
    throw new UnauthorizedError();
  }

  return { userId, sessionId };
}
