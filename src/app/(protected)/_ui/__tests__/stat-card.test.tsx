/**
 * `StatCard` (PLAN §11.1): com `href` é link; sem `href` é bloco estático —
 * cartão sem destino real não finge ser navegável. Vale para as duas variantes
 * (normal e `highlight`).
 */
import { render, screen } from "@testing-library/react";

import { StatCard } from "../stat-card";

describe("StatCard", () => {
  it("com href renderiza um link para o destino, com valor e rótulo", () => {
    render(
      <StatCard
        label="Empresas com Medicina"
        eyebrow="EMPRESAS"
        value={3}
        href="/companies"
      />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/companies");
    expect(link).toHaveTextContent("3");
    expect(link).toHaveTextContent("EMPRESAS");
    expect(link).toHaveTextContent("Empresas com Medicina");
  });

  it("sem href não há link (nem âncora)", () => {
    const { container } = render(
      <StatCard label="Vencidos" value={7} subtext="Pela validade" />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container).toHaveTextContent("7");
    expect(container).toHaveTextContent("Pela validade");
  });

  it("variante highlight segue a mesma regra: link só com href", () => {
    const { unmount } = render(<StatCard label="PGRs" value={2} href="/pgr" highlight />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/pgr");
    unmount();

    const { container } = render(<StatCard label="PGRs" value={2} highlight />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(container).toHaveTextContent("2");
  });

  it("valor zero é exibido (não some)", () => {
    render(<StatCard label="A vencer" value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
