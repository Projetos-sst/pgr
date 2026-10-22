/**
 * `ListErrorState` (Lote 01 da Medicina, PLAN §11.1): erro ≠ vazio. A falha de
 * leitura é anunciada como alerta embutível (`<section role="alert">` + `<h2>`),
 * nunca com o texto de vazio ("Nenhum…"), e "Tentar novamente" aponta para a
 * mesma URL. `hrefWithParams` monta essa URL sem deixar um parâmetro trocar o
 * destino (esquema/host) — valores vão escapados na query string.
 */
import { render, screen, within } from "@testing-library/react";

import { ListErrorState, hrefWithParams } from "../list-error-state";

describe("ListErrorState", () => {
  it("anuncia a falha como alerta com h2 e o link de nova tentativa para a URL dada", () => {
    render(
      <ListErrorState
        title="Não foi possível carregar os exames"
        description="Tente novamente em instantes."
        code="FORBIDDEN"
        retryHref="/health-exams?companyId=11111111-1111-4111-8111-111111111111"
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert.tagName).toBe("SECTION");
    expect(
      within(alert).getByRole("heading", {
        level: 2,
        name: "Não foi possível carregar os exames",
      }),
    ).toBeInTheDocument();
    expect(within(alert).getByText(/Falha na leitura · FORBIDDEN/)).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: "Tentar novamente" })).toHaveAttribute(
      "href",
      "/health-exams?companyId=11111111-1111-4111-8111-111111111111",
    );
  });

  it("nunca usa o texto de vazio nem h1/main (embutível na página)", () => {
    const { container } = render(
      <ListErrorState title="Falhou" description="Erro ao ler." retryHref="/medicine" />,
    );
    expect(container.textContent).not.toMatch(/nenhum/i);
    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("main")).toBeNull();
  });

  it("sem retryHref não renderiza link; sem code não exibe o separador", () => {
    render(<ListErrorState title="Falhou" description="Erro ao ler." />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Falha na leitura")).toBeInTheDocument();
  });
});

describe("hrefWithParams", () => {
  const base = "https://app.example.test";

  it("sem parâmetros (ou só vazios) devolve o caminho base", () => {
    expect(hrefWithParams("/medicine", {})).toBe("/medicine");
    expect(hrefWithParams("/medicine", { companyId: undefined, search: "" })).toBe(
      "/medicine",
    );
  });

  it("preserva os parâmetros informados e ignora os vazios", () => {
    expect(
      hrefWithParams("/health-exams", {
        companyId: "11111111-1111-4111-8111-111111111111",
        employeeId: undefined,
        page: "2",
        search: "",
      }),
    ).toBe("/health-exams?companyId=11111111-1111-4111-8111-111111111111&page=2");
  });

  it("escapa os valores (espaços, &, =, #, acentos)", () => {
    const href = hrefWithParams("/medicine", { search: "João & Cia=1#x" });
    expect(href).toBe("/medicine?search=Jo%C3%A3o+%26+Cia%3D1%23x");
    const parsed = new URL(href, base);
    expect(parsed.searchParams.get("search")).toBe("João & Cia=1#x");
    expect([...parsed.searchParams.keys()]).toEqual(["search"]);
  });

  it("um parâmetro não troca esquema nem host: `javascript:` e `//host` ficam na query", () => {
    for (const value of [
      "javascript:alert(1)",
      "//evil.example.test/x",
      "https://evil.example.test",
    ]) {
      const href = hrefWithParams("/medicine", { search: value });
      expect(href.startsWith("/medicine?search=")).toBe(true);
      expect(href).not.toMatch(/^javascript:/i);
      expect(href).not.toMatch(/^\/\//);
      const parsed = new URL(href, base);
      expect(parsed.origin).toBe(base);
      expect(parsed.pathname).toBe("/medicine");
      expect(parsed.searchParams.get("search")).toBe(value);
    }
  });

  it("chaves também são escapadas (não injetam outro parâmetro)", () => {
    const href = hrefWithParams("/medicine", { "a&b=c": "1" });
    const parsed = new URL(href, base);
    expect([...parsed.searchParams.entries()]).toEqual([["a&b=c", "1"]]);
  });
});
