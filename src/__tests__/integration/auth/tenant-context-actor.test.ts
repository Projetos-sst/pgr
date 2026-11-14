jest.mock("react", () => {
  const actual = jest.requireActual<typeof import("react")>("react");
  const perRender = <T>(create: () => T): (() => T) => {
    const slot: { value?: T } = {};
    return () => (slot.value ??= create());
  };
  return { ...actual, cache: perRender };
});
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => undefined })),
}));
jest.mock("@/shared/db/repositories/org-memberships", () => ({
  listTenantMembershipsByUser: jest.fn(),
}));
jest.mock("@/shared/tenant/provision-personal-tenant", () => ({
  provisionPersonalTenant: jest.fn(),
}));
jest.mock("@/shared/tenant/audit-log", () => ({ logTenantEvent: jest.fn() }));

import { auth } from "@clerk/nextjs/server";

import { NoTenantContextError } from "@/shared/auth/errors";
import { requireTenantContext } from "@/shared/auth/require-tenant-context";
import { listTenantMembershipsByUser } from "@/shared/db/repositories/org-memberships";
import { currentActor } from "@/shared/db/session-actor";

describe("requireTenantContext inside a server render", () => {
  it("leaves no actor when the session has no tenant", async () => {
    jest.mocked(auth).mockResolvedValue(
      Object.assign(await auth(), {
        isAuthenticated: true,
        userId: "user_1",
        sessionId: "sess_1",
      }),
    );
    jest.mocked(listTenantMembershipsByUser).mockResolvedValue([]);
    await expect(requireTenantContext()).rejects.toBeInstanceOf(NoTenantContextError);
    expect(currentActor()).toBeNull();
  });

  it("makes the authenticated user the actor of the render", async () => {
    jest.mocked(listTenantMembershipsByUser).mockResolvedValue([
      {
        orgId: "org_a",
        name: "Org A",
        role: "collaborator",
        scopedCompanyId: null,
        plan: "pro",
        clerkOrgId: null,
      },
    ]);
    const ctx = await requireTenantContext();
    expect(ctx).toMatchObject({ userId: "user_1", tenantId: "org_a" });
    expect(currentActor()).toBe("user_1");
  });
});
