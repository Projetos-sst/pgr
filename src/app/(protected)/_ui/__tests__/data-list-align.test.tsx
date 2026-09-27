/**
 * Alinhamento das primitives de lista (`data-list`). O Lote 3 estendeu `Cell`,
 * `GridColumn`, `MonoCell` e `RowActions` com `center`; estes testes travam o
 * contrato para que as telas novas não voltem a espalhar `text-center` solto e
 * para garantir que o default (`left` nas células, `right` nas ações) continua
 * valendo para as listas já existentes.
 */
import { render, screen } from "@testing-library/react";

import { Cell, GridHeader, MonoCell, RowActions } from "../data-list";

describe("data-list — alinhamento", () => {
  it("Cell sem align não recebe classe de alinhamento", () => {
    render(<Cell>conteúdo</Cell>);
    const cell = screen.getByRole("cell");
    expect(cell.className).not.toMatch(/text-(center|right)/);
  });

  it("Cell align=center centraliza", () => {
    render(<Cell align="center">conteúdo</Cell>);
    expect(screen.getByRole("cell").className).toContain("text-center");
  });

  it("Cell align=right continua alinhando à direita", () => {
    render(<Cell align="right">conteúdo</Cell>);
    expect(screen.getByRole("cell").className).toContain("text-right");
  });

  it("GridHeader aplica o alinhamento declarado por coluna", () => {
    render(
      <GridHeader
        template="1fr 1fr 1fr"
        columns={[
          { header: "Descrição" },
          { header: "Situação", align: "center" },
          { header: "Opções", align: "right" },
        ]}
      />,
    );
    const [descricao, situacao, opcoes] = screen.getAllByRole("columnheader");
    expect(descricao.className).not.toMatch(/text-(center|right)/);
    expect(situacao.className).toContain("text-center");
    expect(opcoes.className).toContain("text-right");
  });

  it("MonoCell aceita centralização", () => {
    render(<MonoCell align="center">CA-1234</MonoCell>);
    expect(screen.getByRole("cell").className).toContain("text-center");
  });

  it("RowActions mantém justify-end por padrão e aceita center", () => {
    const { container, rerender } = render(
      <RowActions>
        <button type="button">x</button>
      </RowActions>,
    );
    expect(container.firstElementChild?.className).toContain("justify-end");
    rerender(
      <RowActions align="center">
        <button type="button">x</button>
      </RowActions>,
    );
    expect(container.firstElementChild?.className).toContain("justify-center");
  });
});
