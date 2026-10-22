/**
 * `EmptyState` ganhou `action` opcional no Lote 01 da Medicina. Sem `action` o
 * componente segue idêntico ao de antes (retrocompatível); com `action`, o CTA
 * aparece abaixo da mensagem.
 */
import Link from "next/link";
import { render, screen } from "@testing-library/react";

import { EmptyState } from "../list";

describe("EmptyState", () => {
  it("sem action: título padrão, mensagem e nenhum link/botão (retrocompatível)", () => {
    render(<EmptyState message="Nenhum médico cadastrado." />);
    expect(
      screen.getByRole("heading", { level: 3, name: "Nenhum registro encontrado" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nenhum médico cadastrado.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("título customizado substitui o padrão", () => {
    render(<EmptyState title="Sem exames" message="Registre o primeiro exame." />);
    expect(screen.getByRole("heading", { name: "Sem exames" })).toBeInTheDocument();
    expect(screen.queryByText("Nenhum registro encontrado")).toBeNull();
  });

  it("com action: renderiza o CTA abaixo da mensagem", () => {
    render(
      <EmptyState
        message="Nenhum exame registrado."
        action={<Link href="/health-exams/new">Registrar exame</Link>}
      />,
    );
    const message = screen.getByText("Nenhum exame registrado.");
    const cta = screen.getByRole("link", { name: "Registrar exame" });
    expect(cta).toHaveAttribute("href", "/health-exams/new");
    expect(
      message.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("isFlat remove a moldura glass", () => {
    const { container, rerender } = render(<EmptyState message="x" />);
    expect(container.firstElementChild?.className).toContain("glass-card");
    rerender(<EmptyState message="x" isFlat />);
    expect(container.firstElementChild?.className).not.toContain("glass-card");
  });
});
