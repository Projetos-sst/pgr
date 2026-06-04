import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

export const MAX_ORGS_PER_USER = 5;

export type OrgQuota = {
  current: number;
  max: number;
  canJoinAnother: boolean;
};

export async function getOrgQuota(userId: string): Promise<OrgQuota> {
  const client = await clerkClient();
  const list = await client.users.getOrganizationMembershipList({ userId });
  const current = list.totalCount;
  return {
    current,
    max: MAX_ORGS_PER_USER,
    canJoinAnother: current < MAX_ORGS_PER_USER,
  };
}

export async function assertCanJoinAnotherOrg(userId: string): Promise<void> {
  const quota = await getOrgQuota(userId);
  if (!quota.canJoinAnother) {
    throw new OrgQuotaExceededError();
  }
}

export class OrgQuotaExceededError extends Error {
  readonly code = "ORG_QUOTA_EXCEEDED" as const;

  constructor(message = "ORG_QUOTA_EXCEEDED") {
    super(message);
    this.name = "OrgQuotaExceededError";
  }
}
