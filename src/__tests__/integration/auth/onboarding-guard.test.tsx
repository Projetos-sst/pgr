/**
 * @jest-environment jsdom
 */
import { auth } from "@clerk/nextjs/server";
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

import ProtectedLayout from "@/app/(protected)/layout";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;
const mockedRedirect = redirect as unknown as jest.Mock;

const setSession = (orgId: string | null) =>
  mockedAuth.mockResolvedValue({
    isAuthenticated: true,
    userId: "user_1",
    sessionId: "sess_1",
    orgId,
    orgRole: orgId ? "org:member" : null,
    orgSlug: orgId ? "acme" : null,
  } as unknown as Awaited<ReturnType<typeof auth>>);

const runLayout = () => ProtectedLayout({ children: <span>negócio</span> });

describe("onboarding guard (bloqueio sem org ativa)", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedRedirect.mockClear();
  });

  it("usuário autenticado sem org ativa → /onboarding (FR-007)", async () => {
    setSession(null);
    await expect(runLayout()).rejects.toThrow(/__redirect:\/onboarding/);
    expect(mockedRedirect).toHaveBeenCalledWith("/onboarding");
  });

  it("usuário removido da org ativa (sessão perde orgId) → /onboarding (FR-010)", async () => {
    setSession(null);
    await expect(runLayout()).rejects.toThrow(/__redirect:\/onboarding/);
    expect(mockedRedirect).toHaveBeenCalledWith("/onboarding");
  });

  it("com org ativa, não redireciona (segue para o shell)", async () => {
    setSession("org_1");
    await expect(runLayout()).resolves.toBeDefined();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });
});
