jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(async () => ({
    isAuthenticated: true,
    userId: "user-a",
    sessionId: "session-a",
  })),
}));
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: "org_a" }) })),
}));
jest.mock("@/shared/tenant/active-tenant", () => ({
  resolveActiveTenant: jest.fn(async () => ({
    tenantId: "org_a",
    plan: "free",
    role: "collaborator",
  })),
}));
jest.mock("@/shared/db/repositories/billing-license", () => ({
  resolveCommercialPlan: jest.fn(async () => "pro"),
}));
import { requireTenantContext } from "@/shared/auth/require-tenant-context";
import { resolveCommercialPlan } from "@/shared/db/repositories/billing-license";
import { resolveActiveTenant } from "@/shared/tenant/active-tenant";
it("uses the active server tenant for the license overlay without elevating the user's role", async () => {
  const ctx = await requireTenantContext();
  expect(resolveCommercialPlan).toHaveBeenCalledWith("org_a", "free");
  expect(ctx).toEqual({
    userId: "user-a",
    tenantId: "org_a",
    plan: "pro",
    role: "collaborator",
  });
});
it("preserves existing Pro when computing the authenticated context", async () => {
  jest.mocked(resolveActiveTenant).mockResolvedValue({
    tenantId: "org_a",
    name: null,
    plan: "pro",
    role: "owner",
    membershipCount: 1,
  });
  jest.mocked(resolveCommercialPlan).mockResolvedValue("pro");
  expect((await requireTenantContext()).plan).toBe("pro");
});
