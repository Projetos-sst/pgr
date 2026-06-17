import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

import { OrgQuotaExceededError } from "./errors";

export { OrgQuotaExceededError };

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
