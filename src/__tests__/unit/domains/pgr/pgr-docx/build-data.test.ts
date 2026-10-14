import {
  buildPgrDocxData,
  CIPA_TRAINING_HOURS,
  countRisksByClass,
  fillTokens,
  validityYears,
  withNumberWord,
} from "@/shared/domains/pgr/pgr-docx/build-data";
import type { PgrDocxContent } from "@/shared/domains/pgr/pgr-docx/content";
import { DEFAULT_LABELS, DEFAULT_TITLES } from "@/shared/domains/pgr/pgr-docx/defaults";
import { PGR_DOCX_EXAMPLE_CONTENT } from "@/shared/domains/pgr/pgr-docx/example-content";

const content = PGR_DOCX_EXAMPLE_CONTENT;

/** Texto visível de um bloco OOXML (sem tags). */
const visible = (xml: string) => xml.replace(/<[^>]+>/g, "");

describe("helpers de texto", () => {
  it("withNumberWord escreve o número por extenso até vinte", () => {
    expect(withNumberWord("4")).toBe("4 (quatro)");
    expect(withNumberWord(" 20 ")).toBe("20 (vinte)");
    expect(withNumberWord("21")).toBe("21");
    expect(withNumberWord("—")).toBe("—");
  });

  it("validityYears extrai o intervalo de anos da vigência", () => {
    expect(validityYears("08/2026 a 05/2028")).toBe("2026–2028");
    expect(validityYears("01/2026 a 12/2026")).toBe("2026");
    expect(validityYears("")).toBe("");
  });

  it("fillTokens troca só os tokens conhecidos", () => {
    expect(
      fillTokens("{empresa} - grau {grauRisco} {outro}", {
        empresa: "X",
        grauRisco: "3",
      }),
    ).toBe("X - grau 3 {outro}");
  });

  it("carga horária da CIPA segue o grau de risco da NR-05", () => {
    expect(CIPA_TRAINING_HOURS).toEqual({ "1": "8", "2": "12", "3": "16", "4": "20" });
  });
});

describe("buildPgrDocxData", () => {
  it("usa os semi-fixos padrão e deriva o sumário dos títulos", () => {
    const data = buildPgrDocxData(content);
    expect(data.labels).toEqual(DEFAULT_LABELS);
    expect(data.titles.introduction).toBe(DEFAULT_TITLES.introduction);
    expect(data.summary[0]).toEqual({ title: DEFAULT_TITLES.introduction });
    expect(data.titles.annexSchedule).toContain("(2026–2028)");
  });

  it("preenche os tokens do texto da CIPA com os dados do PGR", () => {
    const cipa = visible(buildPgrDocxData(content).texts.cipa);
    expect(cipa).toContain("Grau de Risco 3 e possuindo 12 empregados");
    expect(cipa).toContain("composta por 1 (um) representantes titulares");
    expect(cipa).toContain("16 (dezesseis)");
    expect(cipa).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it("carga horária informada no PGR vence o mínimo da NR-05", () => {
    const data = buildPgrDocxData({
      ...content,
      cipa: { ...content.cipa, trainingHours: "20" },
    });
    expect(visible(data.texts.cipa)).toContain("20 (vinte)");
  });

  it("aplica overrides de rótulo, título, texto livre e campanhas", () => {
    const data = buildPgrDocxData(content, {
      overrides: {
        labels: { company: "Contratada:" },
        titles: { introduction: "1 - APRESENTAÇÃO" },
        texts: { objective: "## Escopo\nTexto da {empresa}.\na) item" },
        campaigns: [{ month: "Março", theme: "Março Lilás", actions: "Palestra" }],
      },
    });
    expect(data.labels.company).toBe("Contratada:");
    expect(data.titles.introduction).toBe("1 - APRESENTAÇÃO");
    expect(data.summary[0].title).toBe("1 - APRESENTAÇÃO");
    const objective = data.texts.objective;
    expect(objective).toContain('w:val="PgrSubtitle"');
    expect(objective).toContain('w:val="PgrItem"');
    expect(visible(objective)).toContain(`Texto da ${content.company.razaoSocial}.`);
    expect(visible(data.campaignsXml)).toContain("Março Lilás");
    expect(visible(data.campaignsXml)).not.toContain("Janeiro Branco");
  });

  it("override vazio/undefined não apaga o padrão", () => {
    const data = buildPgrDocxData(content, {
      overrides: { labels: { company: undefined } },
    });
    expect(data.labels.company).toBe(DEFAULT_LABELS.company);
  });

  it("marca a classe e o agente de cada risco e conta o dashboard por GES", () => {
    const data = buildPgrDocxData(content);
    const [, ges2] = data.ges;
    expect(ges2.risks[0].agent).toEqual({ accident: true });
    expect(ges2.risks[0].level).toEqual({ substantial: true });
    expect(ges2.dashboard).toEqual({
      total: "2",
      trivial: "0",
      tolerable: "0",
      moderate: "1",
      substantial: "1",
      intolerable: "0",
    });
  });

  it("bloco do contrato só aparece quando há algum dado de contrato", () => {
    const empty: PgrDocxContent = {
      ...content,
      contract: Object.fromEntries(
        Object.keys(content.contract).map((key) => [key, ""]),
      ) as PgrDocxContent["contract"],
    };
    expect(buildPgrDocxData(content).contract.hasAny).toBe(true);
    expect(buildPgrDocxData(empty).contract.hasAny).toBe(false);
  });

  it("anotado pinta os semi-fixos gerados em código", () => {
    const plain = buildPgrDocxData(content);
    const annotated = buildPgrDocxData(content, { annotate: true });
    expect(plain.texts.introduction).not.toContain("FFD2A6");
    expect(annotated.texts.introduction).toContain('w:fill="FFD2A6"');
  });
});

describe("countRisksByClass", () => {
  it("ignora riscos sem avaliação", () => {
    const risks = content.ges.flatMap((ges) => ges.risks);
    const counts = countRisksByClass([...risks, { ...risks[0], riskClass: null }]);
    expect(counts).toEqual({
      trivial: 0,
      tolerable: 1,
      moderate: 1,
      substantial: 1,
      intolerable: 0,
    });
  });
});
