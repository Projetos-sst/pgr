import {
  AREAS,
  AUTH_HIGHLIGHTS,
  AVAILABILITY_LABEL,
  BENEFITS,
  FAQ,
  HEALTH_MODULES,
  HOW_IT_WORKS,
  PUBLIC_NAV,
  SAFETY_MODULES,
} from "@/app/(public)/_content/platform";

/**
 * Estes testes guardam a regra de honestidade do portal público: a landing não
 * pode anunciar como pronto o que não existe, e não pode voltar a carregar
 * números de marketing sem fonte.
 *
 * A checagem é sobre o conteúdo, não sobre a renderização — é o conteúdo que
 * costuma mudar no susto, horas antes de uma apresentação.
 */
const ALL_MODULES = [...SAFETY_MODULES, ...HEALTH_MODULES];

describe("conteúdo do portal público — honestidade", () => {
  it("todo módulo disponível ou em evolução aponta uma rota real do sistema", () => {
    for (const entry of ALL_MODULES) {
      if (entry.availability === "planned") continue;
      expect(entry.route).toMatch(/^\/[a-z0-9[\]/-]*$/i);
    }
  });

  it("todo módulo planejado não aponta rota — ele ainda não existe", () => {
    for (const entry of ALL_MODULES) {
      if (entry.availability !== "planned") continue;
      expect(entry.route).toBeNull();
    }
  });

  it("os recursos citados na reunião e ainda não implementados estão como planejados", () => {
    const planned = HEALTH_MODULES.filter((m) => m.availability === "planned").map(
      (m) => m.name,
    );
    expect(planned).toEqual(
      expect.arrayContaining([
        "PCMSO",
        "Absenteísmo",
        "Clínicas e solicitação de exames",
      ]),
    );
  });

  it("nenhum texto do portal afirma percentual, métrica ou quantidade de clientes", () => {
    const corpus = JSON.stringify({
      AREAS,
      BENEFITS,
      FAQ,
      HOW_IT_WORKS,
      ALL_MODULES,
      AUTH_HIGHLIGHTS,
    });
    // Pega "92%", "+500 empresas", "3x mais rápido" e parentes.
    expect(corpus).not.toMatch(/\d+\s?%/);
    expect(corpus).not.toMatch(/\+\s?\d{2,}/);
    expect(corpus).not.toMatch(/\d+\s?(x|vezes)\s+mais/i);
  });

  it("o pitch das telas de login não voltou a prometer precisão de IA", () => {
    const corpus = JSON.stringify(AUTH_HIGHLIGHTS).toLowerCase();
    expect(corpus).not.toContain("precisão");
    expect(corpus).not.toContain("92");
  });
});

describe("conteúdo do portal público — integridade estrutural", () => {
  it("tem exatamente as duas vertentes, com slug igual à rota pública", () => {
    expect(AREAS).toHaveLength(2);
    expect(AREAS.map((a) => a.slug)).toEqual([
      "seguranca-do-trabalho",
      "medicina-do-trabalho",
    ]);
  });

  it("a navegação aponta as duas vertentes e só usa caminhos internos", () => {
    const hrefs = PUBLIC_NAV.map((item) => item.href);
    expect(hrefs).toContain("/seguranca-do-trabalho");
    expect(hrefs).toContain("/medicina-do-trabalho");
    for (const href of hrefs) expect(href.startsWith("/")).toBe(true);
  });

  it("não há nome de módulo repetido dentro da mesma vertente", () => {
    for (const list of [SAFETY_MODULES, HEALTH_MODULES]) {
      const names = list.map((m) => m.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("toda disponibilidade usada tem rótulo de exibição", () => {
    for (const entry of ALL_MODULES) {
      expect(AVAILABILITY_LABEL[entry.availability]).toBeTruthy();
    }
  });

  it("o passo a passo está numerado em sequência", () => {
    expect(HOW_IT_WORKS.map((s) => s.step)).toEqual(["01", "02", "03", "04", "05"]);
  });

  it("cada pergunta do FAQ tem resposta não trivial", () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(5);
    for (const item of FAQ) {
      expect(item.q.endsWith("?")).toBe(true);
      expect(item.a.length).toBeGreaterThan(60);
    }
  });

  it("a Segurança apresenta o PGR como primeiro módulo", () => {
    expect(SAFETY_MODULES[0].name).toBe("PGR");
    expect(SAFETY_MODULES[0].route).toBe("/pgr");
  });
});
