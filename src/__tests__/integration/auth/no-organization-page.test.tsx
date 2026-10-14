/**
 * @jest-environment jsdom
 *
 * `/no-organization` — a saída do estado "autenticado, mas sem organização".
 * O que estes testes travam: a página NÃO é pública, NÃO devolve ninguém para
 * `/sign-in` com sessão ativa (era o laço de redirecionamento) e NÃO engole
 * falha de infraestrutura fingindo que é falta de organização.
 */
import { render } from "@testing-library/react";
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`__redirect:${path}`);
  }),
}));

jest.mock("@clerk/nextjs", () => ({
  SignOutButton: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sign-out">{children}</div>
  ),
}));

jest.mock("@/shared/auth/require-tenant-context", () => ({
  requireTenantContext: jest.fn(),
}));

import { requireTenantContext } from "@/shared/auth/require-tenant-context";
import { NoTenantContextError, UnauthorizedError } from "@/shared/auth/errors";
import NoOrganizationPage from "@/app/no-organization/page";

const mockedRequire = requireTenantContext as jest.MockedFunction<
  typeof requireTenantContext
>;
const mockedRedirect = redirect as unknown as jest.Mock;

const renderPage = async () => {
  const node = await NoOrganizationPage();
  return render(node as React.ReactElement);
};

describe("/no-organization", () => {
  beforeEach(() => {
    mockedRequire.mockReset();
    mockedRedirect.mockClear();
  });

  it("sem sessão → manda para o login (não renderiza nada para anônimo)", async () => {
    mockedRequire.mockRejectedValue(new UnauthorizedError());

    await expect(renderPage()).rejects.toThrow("__redirect:/sign-in");
    expect(mockedRedirect).toHaveBeenCalledWith("/sign-in");
  });

  it("autenticado sem organização → explica o estado, sem stack trace e sem beco sem saída", async () => {
    mockedRequire.mockRejectedValue(new NoTenantContextError());

    const { container, getByRole, getByTestId } = await renderPage();

    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(container.textContent).toContain("ainda não está vinculada a uma organização");
    // Caminho de saída: tentar de novo (o provisionamento é auto-reparável) e sair.
    expect(getByRole("link", { name: "Tentar novamente" })).toHaveAttribute(
      "href",
      "/welcome",
    );
    expect(getByTestId("sign-out")).toBeInTheDocument();
    // Nada de NO_TENANT_CONTEXT / pilha de erro vazando para a tela.
    expect(container.textContent).not.toMatch(/NO_TENANT_CONTEXT|Error|at /);
  });

  it("organização já resolvida (self-heal pegou) → volta para a área autenticada, sem prender ninguém", async () => {
    mockedRequire.mockResolvedValue({
      userId: "user_1",
      tenantId: "tenant_1",
      plan: "free",
      role: "owner",
    });

    await expect(renderPage()).rejects.toThrow("__redirect:/welcome");
    expect(mockedRedirect).toHaveBeenCalledWith("/welcome");
  });

  it("falha de infraestrutura NÃO vira 'sem organização' — o erro sobe", async () => {
    mockedRequire.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(renderPage()).rejects.toThrow("ECONNREFUSED");
    expect(mockedRedirect).not.toHaveBeenCalled();
  });
});
