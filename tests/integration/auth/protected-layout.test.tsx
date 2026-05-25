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

type ListProps = {
  hidePersonal?: boolean;
  afterSelectOrganizationUrl?: string;
  afterCreateOrganizationUrl?: string;
};

jest.mock("@clerk/nextjs", () => ({
  OrganizationList: (props: ListProps) => (
    <div
      data-testid="org-list"
      data-hide-personal={String(Boolean(props.hidePersonal))}
      data-after-select={props.afterSelectOrganizationUrl}
      data-after-create={props.afterCreateOrganizationUrl}
    >
      <div data-testid="pending-invitations">convite pendente (mock C3)</div>
    </div>
  ),
}));

import ProtectedLayout from "@/app/(protected)/layout";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;
const mockedRedirect = redirect as unknown as jest.Mock;

const renderLayout = async () => {
  const node = await ProtectedLayout({ children: <span>conteúdo</span> });
  return render(node as React.ReactElement);
};

describe("ProtectedLayout (auth + org inline)", () => {
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

  it("(b) sessão sem org → renderiza <OrganizationList /> inline (sem rota dedicada)", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_1",
      sessionId: "sess_1",
      orgId: null,
    } as unknown as Awaited<ReturnType<typeof auth>>);

    await renderLayout();
    const list = screen.getByTestId("org-list");
    expect(list).toHaveAttribute("data-hide-personal", "true");
    expect(list).toHaveAttribute("data-after-select", "/dashboard");
    expect(list).toHaveAttribute("data-after-create", "/dashboard");
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("(c) sessão com org → renderiza children", async () => {
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
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("(d) C3 — exibe convites pendentes via OrganizationList quando há (FR-011)", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_1",
      sessionId: "sess_1",
      orgId: null,
    } as unknown as Awaited<ReturnType<typeof auth>>);

    await renderLayout();
    expect(screen.getByTestId("pending-invitations")).toBeInTheDocument();
  });
});
