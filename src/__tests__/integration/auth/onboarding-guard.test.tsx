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
  UserButton: () => <div data-testid="user-button" />,
  OrganizationSwitcher: () => <div data-testid="org-switcher" />,
}));

// A barra unificada compõe o TenantSwitcher (server component → cadeia de DB);
// mockar evita carregar a cadeia supabase no import do layout neste teste jsdom.
jest.mock("@/app/_components/tenant-switcher", () => ({
  TenantSwitcher: () => <div data-testid="tenant-switcher" />,
}));

// Mesmo motivo: o sino de notificações importa Server Action → cadeia de DB.
jest.mock("@/app/(protected)/_ui/notifications-bell", () => ({
  NotificationsBell: () => <div data-testid="notifications-bell" />,
}));

jest.mock("@/shared/auth/require-tenant-context", () => ({
  requireTenantContext: jest.fn(),
}));

// Badge da Trilha de Sucesso: a Server Action importa a cadeia de DB;
// mockar evita carregar o driver postgres no jsdom (mesmo motivo dos mocks acima).
jest.mock("@/shared/server/actions/platform/onboarding", () => ({
  getOnboardingProgressAction: jest.fn(async () => ({
    ok: true,
    data: { allDone: true },
  })),
}));

jest.mock("@/shared/server/actions/platform/access-scopes", () => ({
  getOwnAccessAreasAction: jest.fn(async () => ({
    ok: true,
    data: ["safety", "health"],
  })),
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

  it("sem tenant ativo → bloqueio em '/no-organization' (nunca '/onboarding') (FR-024)", async () => {
    mockedRequire.mockRejectedValue(new NoTenantContextError());

    await expect(runLayout()).rejects.toThrow(/__redirect:\/no-organization/);
    expect(mockedRedirect).toHaveBeenCalledWith("/no-organization");
    // A rota `/onboarding` segue aposentada; o estado sem organização tem tela
    // própria, que exige sessão e não exige tenant.
    expect(mockedRedirect).not.toHaveBeenCalledWith("/onboarding");
  });
});
