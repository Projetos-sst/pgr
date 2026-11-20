import { render, screen, within } from "@testing-library/react";

import TermosPage from "@/app/(public)/(marketing)/termos/page";
import { PortalFooter } from "@/app/(public)/_portal/portal-footer";

describe("/termos", () => {
  it("traz a cláusula de uso de inteligência artificial", () => {
    render(<TermosPage />);

    const section = screen.getByRole("region", {
      name: "Uso de inteligência artificial",
    });
    expect(section).toHaveTextContent("A IA pode errar");
    expect(section).toHaveTextContent("revisar cada campo antes de salvar");
    expect(section).toHaveTextContent("não se responsabiliza");
    expect(section).toHaveTextContent("PGR, PCMSO e ASO");
    expect(section).toHaveTextContent("profissional habilitado");
  });

  it("tem todas as seções e a data da última atualização", () => {
    render(<TermosPage />);

    for (const heading of [
      "Objeto",
      "Conta e acesso",
      "Responsabilidade pelo conteúdo",
      "Uso de inteligência artificial",
      "Dados",
      "Alterações dos termos",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name: heading }),
      ).toBeInTheDocument();
    }
    expect(screen.getByText("Última atualização: 20/11/2026")).toBeInTheDocument();
  });

  it("não cita o fornecedor da IA", () => {
    const { container } = render(<TermosPage />);
    expect(container.textContent ?? "").not.toMatch(
      /openai|anthropic|claude|gpt|gemini/i,
    );
  });
});

describe("PortalFooter", () => {
  it.each<"completo" | "compacto">(["completo", "compacto"])(
    "variante %s tem o link para os termos de uso",
    (variante) => {
      render(<PortalFooter variante={variante} />);
      const footer = screen.getByRole("contentinfo");
      expect(within(footer).getByRole("link", { name: "Termos de uso" })).toHaveAttribute(
        "href",
        "/termos",
      );
    },
  );
});
