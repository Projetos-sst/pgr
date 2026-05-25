import "server-only";

export type AuthContext = {
  userId: string;
  sessionId: string;
};

export type OrgAuthContext = AuthContext & {
  orgId: string;
  orgRole: string | null;
  orgSlug: string | null;
};
