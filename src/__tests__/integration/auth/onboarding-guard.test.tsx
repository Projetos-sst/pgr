/**
 * @jest-environment jsdom
 */
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`__redirect:${path}`);
  }),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => ({ get: () => null })),
}));

jest.mock("@clerk/nextjs", () => ({
  OrganizationSwitcher: () => <div data-testid="org-switcher" />,
}));

jest.mock("@/shared/auth/require-tenant-context", () => ({
  requireTenantContext: jest.fn(),
}));

import { requireTenantContext } from "@/shared/auth/require-tenant-context";
import { NoTenantContextError } from "@/shared/auth/errors";
import ProtectedLayout from "@/app/(protected)/layout";

const mockedRequire = requireTenantContext as jest.MockedFunction<
  typeof requireTenantContext
>;
const mockedRedirect = redirect as unknown as jest.Mock;

const runLayout = () => ProtectedLayout({ children: <span>negócio</span> });

describe("Modelo B — onboarding superseded (US1: sem onboarding para free)", () => {
  beforeEach(() => {
    mockedRequire.mockReset();
    mockedRedirect.mockClear();
  });

  it("free com tenant próprio resolvido → segue para o shell, SEM redirect('/onboarding')", async () => {
    mockedRequire.mockResolvedValue({
      userId: "user_1",
      tenantId: "tenant_1",
      plan: "free",
      role: "owner",
    });

    await expect(runLayout()).resolves.toBeDefined();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("sem tenant ativo → bloqueio em '/sign-in' (nunca '/onboarding') (FR-024)", async () => {
    mockedRequire.mockRejectedValue(new NoTenantContextError());

    await expect(runLayout()).rejects.toThrow(/__redirect:\/sign-in/);
    expect(mockedRedirect).toHaveBeenCalledWith("/sign-in");
    expect(mockedRedirect).not.toHaveBeenCalledWith("/onboarding");
  });
});
