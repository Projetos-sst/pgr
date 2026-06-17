/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";

import Forbidden from "@/app/forbidden";
import Unauthorized from "@/app/unauthorized";

describe("Páginas de erro padrão (401/403)", () => {
  it("Unauthorized: H1 + link 'Entrar' apontando para /sign-in, sem PII/stack", () => {
    const { container } = render(<Unauthorized />);
    expect(
      screen.getByRole("heading", { level: 1, name: /autenticado/i }),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Entrar/i });
    expect(link).toHaveAttribute("href", "/sign-in");
    expect(container.textContent).not.toMatch(/stack|error|userId|email/i);
  });

  it("Forbidden: H1 + link 'Voltar' apontando para /dashboard", () => {
    const { container } = render(<Forbidden />);
    expect(
      screen.getByRole("heading", { level: 1, name: /permissão/i }),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Voltar/i });
    expect(link).toHaveAttribute("href", "/dashboard");
    expect(container.textContent).not.toMatch(/stack|error|userId|email/i);
  });
});
