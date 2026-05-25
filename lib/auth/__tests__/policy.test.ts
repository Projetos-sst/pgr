import { clerkClient } from "@clerk/nextjs/server";

import {
  MAX_ORGS_PER_USER,
  OrgQuotaExceededError,
  assertCanJoinAnotherOrg,
  getOrgQuota,
} from "../policy";

const mockedClerkClient = clerkClient as jest.MockedFunction<typeof clerkClient>;

const setMembershipCount = (count: number) => {
  mockedClerkClient.mockResolvedValue({
    users: {
      getOrganizationMembershipList: jest.fn(async () => ({
        data: [],
        totalCount: count,
      })),
    },
  } as unknown as Awaited<ReturnType<typeof clerkClient>>);
};

describe("policy", () => {
  beforeEach(() => mockedClerkClient.mockReset());

  it("MAX_ORGS_PER_USER é 5 (regra de negócio)", () => {
    expect(MAX_ORGS_PER_USER).toBe(5);
  });

  it("getOrgQuota: usuário com 3 orgs pode entrar em mais 2", async () => {
    setMembershipCount(3);
    await expect(getOrgQuota("user_1")).resolves.toEqual({
      current: 3,
      max: 5,
      canJoinAnother: true,
    });
  });

  it("getOrgQuota: usuário no limite (5) não pode entrar em mais", async () => {
    setMembershipCount(5);
    await expect(getOrgQuota("user_1")).resolves.toEqual({
      current: 5,
      max: 5,
      canJoinAnother: false,
    });
  });

  it("assertCanJoinAnotherOrg: passa quando há vaga", async () => {
    setMembershipCount(4);
    await expect(assertCanJoinAnotherOrg("user_1")).resolves.toBeUndefined();
  });

  it("assertCanJoinAnotherOrg: lança OrgQuotaExceededError no limite", async () => {
    setMembershipCount(5);
    await expect(assertCanJoinAnotherOrg("user_1")).rejects.toBeInstanceOf(
      OrgQuotaExceededError,
    );
  });

  it("OrgQuotaExceededError carrega code estável e mensagem sem PII", () => {
    const e = new OrgQuotaExceededError();
    expect(e.code).toBe("ORG_QUOTA_EXCEEDED");
    expect(e.message).toBe("ORG_QUOTA_EXCEEDED");
  });
});
