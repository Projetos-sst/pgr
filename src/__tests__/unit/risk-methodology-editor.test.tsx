/**
 * Editor da Metodologia de Avaliação de Riscos — o refinamento visual da tela
 * reorganizou cartões, grade e matriz. Estes testes travam o que NÃO pode mudar
 * junto: a matriz continua derivando `probabilidade × severidade` e a classe de
 * cada célula continua vindo das faixas; mais o que o refinamento acrescentou:
 * campo padronizado do design system e erro de faixa junto do próprio campo.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const saveRiskMethodologyAction = jest.fn(
  async (_input: unknown) => ({ ok: true, data: {} }) as const,
);
jest.mock("@/shared/server/actions/pgr/risk-methodology", () => ({
  saveRiskMethodologyAction: (input: unknown) => saveRiskMethodologyAction(input),
}));

import { fieldClass } from "@/app/(protected)/_ui/form";
import {
  MethodologyEditor,
  splitControlLabel,
} from "@/app/(protected)/risk-methodology/_components/methodology-editor";
import { defaultRiskMethodology } from "@/shared/domains/pgr/methodology-presets";
import type { RiskMethodologyView } from "@/shared/domains/pgr/methodology";

const initial: RiskMethodologyView = { configured: true, ...defaultRiskMethodology() };

/** Células da matriz, linha a linha, como "nível|classe". */
function matrixRows(): string[][] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => (cell.textContent ?? "").trim()),
    );
}

function bandInputs(): HTMLInputElement[] {
  return screen.getAllByLabelText("Limite superior") as HTMLInputElement[];
}

describe("MethodologyEditor", () => {
  beforeEach(() => jest.clearAllMocks());

  it("a matriz 5×5 deriva nível e classe dos padrões (Fundacentro)", () => {
    render(<MethodologyEditor initial={initial} />);
    const rows = matrixRows();

    expect(rows).toHaveLength(5);
    // prob 1 × sev 1..5 → 1,2 (Trivial) e 3,4,5 (Tolerável)
    expect(rows[0]).toEqual([
      "1Trivial",
      "2Trivial",
      "3Tolerável",
      "4Tolerável",
      "5Tolerável",
    ]);
    // prob 5 × sev 1..5 → 5,10,15,20,25
    expect(rows[4]).toEqual([
      "5Tolerável",
      "10Moderado",
      "15Substancial",
      "20Substancial",
      "25Intolerável",
    ]);
  });

  it("editar o rótulo de uma gradação reflete no cabeçalho da matriz", () => {
    render(<MethodologyEditor initial={initial} />);

    fireEvent.change(screen.getByLabelText("Rótulo do nível 1 de probabilidade"), {
      target: { value: "Remotíssima" },
    });

    expect(screen.getByRole("rowheader", { name: /Remotíssima/ })).toBeInTheDocument();
  });

  it("mudar o limite de uma faixa reclassifica as células (regra derivada intacta)", () => {
    render(<MethodologyEditor initial={initial} />);

    // Trivial passa a cobrir até 6 — tudo de 1 a 6 vira Trivial.
    fireEvent.change(bandInputs()[0], { target: { value: "6" } });

    expect(matrixRows()[0]).toEqual([
      "1Trivial",
      "2Trivial",
      "3Trivial",
      "4Trivial",
      "5Trivial",
    ]);
  });

  it("limite fora de ordem aponta o erro no próprio campo, e o servidor segue decidindo", async () => {
    const { container } = render(<MethodologyEditor initial={initial} />);

    fireEvent.change(bandInputs()[0], { target: { value: "6" } });

    // O campo acusado é o da faixa seguinte (Tolerável, que também fecha em 6).
    expect(bandInputs()[1]).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Deve ser maior que 6.")).toBeInTheDocument();

    // A validação do cliente é um aviso, não um portão: a ação continua sendo
    // chamada e o schema do servidor é quem recusa.
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(saveRiskMethodologyAction).toHaveBeenCalledTimes(1));
  });

  it("a última faixa fica travada em 25", () => {
    render(<MethodologyEditor initial={initial} />);
    const inputs = bandInputs();

    expect(inputs).toHaveLength(5);
    expect(inputs[4]).toBeDisabled();
    expect(inputs[4]).toHaveValue(25);
  });

  it("todo campo editável usa a classe de campo do design system", () => {
    const { container } = render(<MethodologyEditor initial={initial} />);
    const inputs = [...container.querySelectorAll("input")];

    // 10 gradações (rótulo + descrição ×5 em dois eixos) + 5 faixas.
    expect(inputs).toHaveLength(25);
    for (const input of inputs) {
      expect(input.className).toContain(fieldClass);
    }
  });

  it("o aviso de metodologia não configurada só aparece quando é o caso", () => {
    const { rerender } = render(<MethodologyEditor initial={initial} />);
    expect(screen.queryByText(/ainda não configurou uma metodologia/)).toBeNull();

    rerender(<MethodologyEditor initial={{ ...initial, configured: false }} />);
    expect(screen.getByText(/ainda não configurou uma metodologia/)).toBeInTheDocument();
  });
});

describe("splitControlLabel", () => {
  it("separa o algarismo romano do nome da medida", () => {
    expect(splitControlLabel("I — Eliminação")).toEqual({
      index: "I",
      name: "Eliminação",
    });
    expect(splitControlLabel("III — Medidas Administrativas/Organização")).toEqual({
      index: "III",
      name: "Medidas Administrativas/Organização",
    });
  });

  it("sem o separador, devolve a etiqueta inteira (nada se perde na tela)", () => {
    expect(splitControlLabel("Eliminação")).toEqual({ index: "", name: "Eliminação" });
  });
});
