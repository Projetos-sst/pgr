import "server-only";

import { auth } from "@clerk/nextjs/server";

export type SessionSnapshot = {
  isAuthenticated: boolean;
  userId: string | null;
  sessionId: string | null;
  orgId: string | null;
};

export async function getSessionOrNull(): Promise<SessionSnapshot> {
  const s = await auth();
  return {
    isAuthenticated: Boolean(s.isAuthenticated),
    userId: s.userId ?? null,
    sessionId: s.sessionId ?? null,
    orgId: s.orgId ?? null,
  };
}
