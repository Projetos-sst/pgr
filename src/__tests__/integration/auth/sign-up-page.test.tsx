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

jest.mock("@clerk/nextjs", () => ({
  SignUp: ({ path }: { path: string }) => (
    <div data-testid="clerk-sign-up" data-path={path}>
      sign-up widget
    </div>
  ),
}));

import SignUpPage from "@/app/(public)/sign-up/[[...sign-up]]/page";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;
const mockedRedirect = redirect as unknown as jest.Mock;

const renderPage = async (
  searchParams: Record<string, string | string[] | undefined>,
) => {
  const node = await SignUpPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(node as React.ReactElement);
};

describe("SignUpPage (invite-only)", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedAuth.mockResolvedValue({
      isAuthenticated: false,
    } as unknown as Awaited<ReturnType<typeof auth>>);
    mockedRedirect.mockClear();
  });

  it("anônimo + sem __clerk_ticket: exibe mensagem de convite obrigatório", async () => {
    await renderPage({});
    expect(screen.queryByTestId("clerk-sign-up")).toBeNull();
    expect(screen.getByText(/Cadastro por convite/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Entrar/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("anônimo + __clerk_ticket: monta o <SignUp /> do Clerk", async () => {
    await renderPage({ __clerk_ticket: "abc123" });
    const node = screen.getByTestId("clerk-sign-up");
    expect(node).toBeInTheDocument();
    expect(node).toHaveAttribute("data-path", "/sign-up");
  });

  it("logado + sem ticket: redireciona para /dashboard (não fica na página)", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: "u1",
    } as unknown as Awaited<ReturnType<typeof auth>>);
    await expect(SignUpPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "__redirect:/dashboard",
    );
    expect(mockedRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("logado + COM ticket: força sign-out antes (evita account takeover via ticket de terceiro)", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: "u1",
    } as unknown as Awaited<ReturnType<typeof auth>>);
    await expect(
      SignUpPage({
        searchParams: Promise.resolve({ __clerk_ticket: "abc123" }),
      }),
    ).rejects.toThrow(/__redirect:\/sign-out/);
    expect(mockedRedirect).toHaveBeenCalledWith(
      "/sign-out?redirect_url=/sign-up?__clerk_ticket=abc123",
    );
  });

  it("ticket inválido (array): tratado como ausente — mostra mensagem de convite", async () => {
    await renderPage({ __clerk_ticket: ["a", "b"] });
    expect(screen.queryByTestId("clerk-sign-up")).toBeNull();
    expect(screen.getByText(/Cadastro por convite/i)).toBeInTheDocument();
  });

  it("ticket inválido (string vazia): tratado como ausente", async () => {
    await renderPage({ __clerk_ticket: "" });
    expect(screen.queryByTestId("clerk-sign-up")).toBeNull();
    expect(screen.getByText(/Cadastro por convite/i)).toBeInTheDocument();
  });
});
