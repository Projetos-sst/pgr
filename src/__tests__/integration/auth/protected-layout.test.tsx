/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`__redirect:${path}`);
  }),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => ({
    get: (key: string) => (key === "x-pathname" ? "/dashboard" : null),
  })),
}));

jest.mock("@clerk/nextjs", () => ({
  OrganizationSwitcher: (props: {
    hidePersonal?: boolean;
    afterSelectOrganizationUrl?: string;
  }) => (
    <div
      data-testid="org-switcher"
      data-hide-personal={String(Boolean(props.hidePersonal))}
      data-after-select={props.afterSelectOrganizationUrl}
    />
  ),
}));

jest.mock("@/shared/auth/require-tenant-context", () => ({
  requireTenantContext: jest.fn(),
}));

import { requireTenantContext } from "@/shared/auth/require-tenant-context";
import { NoTenantContextError, UnauthorizedError } from "@/shared/auth/errors";
import ProtectedLayout from "@/app/(protected)/layout";

const mockedRequire = requireTenantContext as jest.MockedFunction<
  typeof requireTenantContext
>;
const mockedRedirect = redirect as unknown as jest.Mock;

const renderLayout = async () => {
  const node = await ProtectedLayout({ children: <span>conteúdo</span> });
  return render(node as React.ReactElement);
};

describe("ProtectedLayout (gate Modelo B via requireTenantContext)", () => {
  beforeEach(() => {
    mockedRequire.mockReset();
    mockedRedirect.mockClear();
  });

  it("(a) sem sessão (UnauthorizedError) → redirect('/sign-in?redirect_url=...')", async () => {
    mockedRequire.mockRejectedValue(new UnauthorizedError());

    await expect(renderLayout()).rejects.toThrow(/__redirect:\/sign-in/);
    expect(mockedRedirect).toHaveBeenCalledWith("/sign-in?redirect_url=%2Fdashboard");
  });

  it("(b) sem tenant ativo (NoTenantContextError) → redirect('/sign-in') (FR-024)", async () => {
    mockedRequire.mockRejectedValue(new NoTenantContextError());

    await expect(renderLayout()).rejects.toThrow(/__redirect:\/sign-in/);
    expect(mockedRedirect).toHaveBeenCalledWith("/sign-in");
  });

  it("(c) tenant ativo resolvido → renderiza children, sem onboarding nem switcher duplicado", async () => {
    mockedRequire.mockResolvedValue({
      userId: "user_1",
      tenantId: "tenant_1",
      plan: "free",
      role: "owner",
    });

    const { container } = await renderLayout();
    expect(container.textContent).toContain("conteúdo");
    expect(screen.queryByTestId("org-switcher")).toBeNull();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });
});
