/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { auth } from "@clerk/nextjs/server";
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

import ProtectedLayout from "@/app/(protected)/layout";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;
const mockedRedirect = redirect as unknown as jest.Mock;

const renderLayout = async () => {
  const node = await ProtectedLayout({ children: <span>conteúdo</span> });
  return render(node as React.ReactElement);
};

describe("ProtectedLayout (auth + bloqueio de org)", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedRedirect.mockClear();
  });

  it("(a) sem sessão → redirect('/sign-in')", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: false,
      userId: null,
      sessionId: null,
    } as unknown as Awaited<ReturnType<typeof auth>>);

    await expect(renderLayout()).rejects.toThrow(/__redirect:\/sign-in/);
    expect(mockedRedirect).toHaveBeenCalledWith("/sign-in?redirect_url=%2Fdashboard");
  });

  it("(b) sessão sem org → redirect('/onboarding')", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_1",
      sessionId: "sess_1",
      orgId: null,
    } as unknown as Awaited<ReturnType<typeof auth>>);

    await expect(renderLayout()).rejects.toThrow(/__redirect:\/onboarding/);
    expect(mockedRedirect).toHaveBeenCalledWith("/onboarding");
  });

  it("(c) sessão com org → renderiza shell (switcher) + children", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_1",
      sessionId: "sess_1",
      orgId: "org_1",
      orgRole: "org:admin",
      orgSlug: "acme",
    } as unknown as Awaited<ReturnType<typeof auth>>);

    const { container } = await renderLayout();
    expect(container.textContent).toContain("conteúdo");
    const switcher = screen.getByTestId("org-switcher");
    expect(switcher).toHaveAttribute("data-hide-personal", "true");
    expect(switcher).toHaveAttribute("data-after-select", "/dashboard");
    expect(mockedRedirect).not.toHaveBeenCalled();
  });
});
