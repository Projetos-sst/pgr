import {
  buildPgrDocxData,
  CIPA_TRAINING_HOURS,
  countRisksByClass,
  fillTokens,
  validityYears,
  withNumberWord,
} from "@/shared/domains/pgr/pgr-docx/build-data";
import type { ClassificationBand } from "@/shared/domains/pgr/methodology";
import type { PgrDocxContent } from "@/shared/domains/pgr/pgr-docx/content";
import {
  DEFAULT_LABELS,
  DEFAULT_METHODOLOGY,
  DEFAULT_TITLES,
} from "@/shared/domains/pgr/pgr-docx/defaults";
import { PGR_DOCX_EXAMPLE_CONTENT } from "@/shared/domains/pgr/pgr-docx/example-content";
import { buildPgrDocxPreviewContent } from "@/shared/domains/pgr/pgr-docx/preview";
import { wrapLines } from "@/shared/domains/pgr/pgr-docx/table-lines";
import { textWidth } from "@/shared/domains/pgr/pgr-docx/text-fit";
import { PGR_DOCX_SIZES } from "@/shared/domains/pgr/pgr-docx/theme";

const content = PGR_DOCX_EXAMPLE_CONTENT;

const fundacentro: ClassificationBand[] = [
  { classification: "trivial", maxLevel: 2 },
  { classification: "tolerable", maxLevel: 6 },
  { classification: "moderate", maxLevel: 12 },
  { classification: "substantial", maxLevel: 20 },
  { classification: "intolerable", maxLevel: 25 },
];

/** Texto visível de um bloco OOXML (sem tags). */
const visible = (xml: string) => xml.replace(/<[^>]+>/g, "").replace(/\u00A0/g, " ");

const plain = (text: string) => text.replace(/\u00A0/g, " ").replace(/\n/g, " ");

const plainRow = (row: Record<string, string>) =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [key, plain(value)]));

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
    const { controlNeedPriority, ...labels } = data.labels;
    const { controlNeedPriority: defaultPriority, ...defaults } = DEFAULT_LABELS;
    expect(labels).toEqual(defaults);
    expect(controlNeedPriority.replace(/\n/g, " ")).toBe(defaultPriority);
    expect(data.titles.introduction).toBe(DEFAULT_TITLES.introduction);
    expect(data.summary[0]).toEqual({ title: DEFAULT_TITLES.introduction });
    expect(data.titles.annexSchedule).toContain("(2026–2028)");
  });

  it("preenche os tokens do texto da CIPA com os dados do PGR", () => {
    const cipa = visible(buildPgrDocxData(content).texts.cipa);
    expect(cipa).toContain("Grau de Risco 3 e possuindo 12 empregados");
    expect(cipa).toContain(
      "composta por 1 (um) representante titular e 1 (um) representante suplente",
    );
    expect(cipa).toContain("16 (dezesseis)");
    expect(cipa).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it("CIPA com mais de um membro usa o plural e o número por extenso", () => {
    const cipa = visible(
      buildPgrDocxData({
        ...content,
        cipa: { ...content.cipa, effectiveMembers: "2", alternateMembers: "3" },
      }).texts.cipa,
    );
    expect(cipa).toContain(
      "2 (dois) representantes titulares e 3 (três) representantes suplentes",
    );
  });

  it("sem número de empregados a frase da CIPA sai sem o número e sem buraco", () => {
    const cipa = visible(
      buildPgrDocxData({
        ...content,
        cipa: { ...content.cipa, employeeCount: undefined },
        jobRoles: [],
        jobRolesTotal: "0",
      }).texts.cipa,
    );
    expect(cipa).toContain("classificado com Grau de Risco 3, manterá constituída");
    expect(cipa).not.toContain("possuindo");
    expect(cipa).not.toMatch(/ {2}/);
  });

  it("número de empregados da CIPA cai para a soma das funções", () => {
    const cipa = visible(
      buildPgrDocxData({
        ...content,
        cipa: { ...content.cipa, employeeCount: "" },
        jobRolesTotal: "7",
      }).texts.cipa,
    );
    expect(cipa).toContain("Grau de Risco 3 e possuindo 7 empregados");
  });

  it("número de empregados da CIPA é a soma das funções, não o cadastro da CIPA", () => {
    const cipa = visible(
      buildPgrDocxData({
        ...content,
        cipa: { ...content.cipa, employeeCount: "93" },
        jobRolesTotal: "94",
      }).texts.cipa,
    );
    expect(cipa).toContain("possuindo 94 empregados");
  });

  it("texto editado com {numeroEmpregados} sem dado mostra traço", () => {
    const data = buildPgrDocxData(
      {
        ...content,
        cipa: { ...content.cipa, employeeCount: undefined },
        jobRolesTotal: "",
      },
      { overrides: { texts: { cipa: "Efetivo: {numeroEmpregados}." } } },
    );
    expect(visible(data.texts.cipa)).toContain("Efetivo: —.");
  });

  it("carga horária informada no PGR vence o mínimo da NR-05", () => {
    const data = buildPgrDocxData({
      ...content,
      cipa: { ...content.cipa, trainingHours: "20" },
    });
    expect(visible(data.texts.cipa)).toContain("20 (vinte)");
  });

  it("carga horária só com espaços cai no mínimo da NR-05 do grau de risco", () => {
    const cipa = visible(
      buildPgrDocxData({
        ...content,
        cipa: { ...content.cipa, riskGrade: "3", trainingHours: "   " },
      }).texts.cipa,
    );
    expect(cipa).toContain("16 (dezesseis)");
  });

  it("CIPA sem membros informados usa a composição genérica, sem traço", () => {
    const cipa = visible(
      buildPgrDocxData({
        ...content,
        cipa: { ...content.cipa, effectiveMembers: "", alternateMembers: "" },
      }).texts.cipa,
    );
    expect(cipa).toContain("composta por representantes titulares e suplentes eleitos");
    expect(cipa).not.toContain("—");
  });

  it("CIPA sem grau de risco nem empregados: frases sem buraco e com a carga horária genérica", () => {
    const cipa = visible(
      buildPgrDocxData({
        ...content,
        company: { ...content.company, riskGrade: "" },
        cipa: { riskGrade: "", employeeCount: "" },
        jobRolesTotal: "",
      }).texts.cipa,
    );
    expect(cipa).toContain("este estabelecimento manterá constituída");
    expect(cipa).toContain(
      "carga horária mínima prevista para o grau de risco do estabelecimento",
    );
    expect(cipa).not.toContain("Grau de Risco ,");
    expect(cipa).not.toContain("—");
  });

  it("CIPA sem grau de risco com carga horária informada: a frase segue sem o grau", () => {
    const cipa = visible(
      buildPgrDocxData({
        ...content,
        company: { ...content.company, riskGrade: "" },
        cipa: { ...content.cipa, riskGrade: "", trainingHours: "20" },
      }).texts.cipa,
    );
    expect(cipa).toContain("mínima de 20 (vinte) horas.");
    expect(cipa).not.toContain("por se tratar");
  });

  it("prévia mantém {numeroEmpregados} na frase da CIPA", () => {
    const cipa = visible(buildPgrDocxData(buildPgrDocxPreviewContent()).texts.cipa);
    expect(cipa).toContain("possuindo {numeroEmpregados} empregados");
    expect(cipa).not.toContain("{{jobRolesTotal}}");
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

  it("título do Anexo I sem parênteses vazios quando não há vigência", () => {
    const data = buildPgrDocxData({ ...content, validity: "", validityYears: undefined });
    const title = "23 - Anexo I – Cronograma de Implementação e Acompanhamento do PGR";
    expect(data.titles.annexSchedule).toBe(title);
    expect(data.summary.map((item) => item.title)).toContain(title);
  });

  it("vazios: descrição do GES 'Não informado' e total de funções 0", () => {
    const data = buildPgrDocxData({
      ...content,
      jobRoles: [],
      jobRolesTotal: "",
      ges: [{ ...content.ges[0], processDescription: " " }],
    });
    expect(data.jobRolesTotal).toBe("0");
    expect(data.ges[0].processDescription).toBe("Não informado");
    expect(data.ges[0].risks[0]).not.toHaveProperty("assessmentDetails");
  });

  it("Anexo I reúne as ações de todos os GES", () => {
    const data = buildPgrDocxData(content);
    const total = content.ges.reduce((sum, ges) => sum + ges.actions.length, 0);
    expect(data.annexActions).toHaveLength(total);
    const [ges2] = content.ges.slice(1);
    expect(data.annexActions.map(plainRow)).toContainEqual(
      plainRow({
        gesTitle: ges2.title,
        riskRef: "RISCO 1",
        occupationalRisk: ges2.actions[0].occupationalRisk,
        action: ges2.actions[0].action,
        responsible: ges2.actions[0].responsible,
        deadline: ges2.actions[0].deadline,
        status: ges2.actions[0].status,
      }),
    );
    expect(buildPgrDocxData({ ...content, ges: [] }).annexActions).toEqual([]);
  });

  it("sem faixas da organização mantém a matriz e as faixas de referência", () => {
    const data = buildPgrDocxData(content);
    const matrix = visible(data.texts.riskCategoryMatrix);
    expect(matrix).toContain("- Trivial (1-3);");
    expect(matrix).toContain("- Intolerável (15-25).");
    const example = visible(data.texts.riskCategoryExample);
    expect(example).toContain("resultando em 6 (moderado)");
    expect(example).toContain("Obs.:");
    expect(data.riskLevelLabels.tolerable).toBe("Tolerável (3-8)");
    expect(visible(data.riskMatrixXml)).toContain("15-25");
  });

  it("com as faixas da organização: textos, legenda, matriz e dashboard seguem as faixas", () => {
    const data = buildPgrDocxData({ ...content, classificationBands: fundacentro });
    const matrix = visible(data.texts.riskCategoryMatrix);
    for (const item of [
      "- Trivial (1-2);",
      "- Tolerável (3-6);",
      "- Moderado (7-12);",
      "- Substancial (13-20);",
      "- Intolerável (21-25).",
    ]) {
      expect(matrix).toContain(item);
    }
    const example = visible(data.texts.riskCategoryExample);
    expect(example).toContain("resultando em 6 (tolerável)");
    expect(example).not.toContain("Obs.:");
    expect(data.riskLevelLabels).toEqual({
      trivial: "Trivial (1-2)",
      tolerable: "Tolerável (3-6)",
      moderate: "Moderado (7-12)",
      substantial: "Substancial (13-20)",
      intolerable: "Intolerável (21-25)",
    });
    const legend = visible(data.riskMatrixXml);
    expect(legend).toContain("21-25");
    expect(legend).not.toContain("15-25");
  });

  it("override de texto mantém a observação escrita pelo PGR", () => {
    const data = buildPgrDocxData(
      { ...content, classificationBands: fundacentro },
      { overrides: { texts: { riskCategoryExample: "**Obs.:** nota própria" } } },
    );
    expect(visible(data.texts.riskCategoryExample)).toContain("Obs.: nota própria");
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
    expect(plain.cover.validityXml).not.toContain("FFD2A6");
    expect(annotated.cover.validityXml).toContain('w:fill="FFD2A6"');
  });

  it("capa: cada linha vem da empresa, da unidade e do contrato, em caixa alta", () => {
    const { cover } = buildPgrDocxData(content);
    expect(visible(cover.validityXml)).toBe("VIGÊNCIA: 10/2026 a 09/2028");
    expect(visible(cover.razaoSocialXml)).toBe("CONSTRUTORA HORIZONTE EXEMPLO LTDA");
    expect(visible(cover.nomeFantasiaXml)).toBe("HORIZONTE EXEMPLO");
    expect(visible(cover.cityStateXml)).toBe("CAMPINAS - SP");
    expect(visible(cover.workUnitXml)).toBe("OBRA RESIDENCIAL JARDIM EXEMPLO");
    expect(visible(cover.contractXml)).toBe("CONTRATO: CT-0001/2026");
  });

  it("capa: fantasia igual à razão e contrato vazio somem sem deixar buraco", () => {
    const data = buildPgrDocxData({
      ...content,
      company: {
        ...content.company,
        nomeFantasia: content.company.razaoSocial.toLowerCase(),
      },
      workUnit: { ...content.workUnit, contractNumbers: "" },
    });
    expect(data.cover.nomeFantasiaXml).toBe("");
    expect(data.cover.contractXml).toBe("");
    expect(visible(data.cover.razaoSocialXml)).toBe("CONSTRUTORA HORIZONTE EXEMPLO LTDA");
  });

  it("empresa e unidade saem em caixa alta; o endereço da obra e os demais campos não", () => {
    const data = buildPgrDocxData({
      ...content,
      company: {
        ...content.company,
        razaoSocial: "Acme Construções Ltda",
        nomeFantasia: "Acme",
        cityState: "São Paulo - SP",
        address: "Rua das Flores, 10",
      },
      workUnit: { ...content.workUnit, name: "Obra Centro", address: "Rua das Obras, 5" },
    });
    expect(data.company.razaoSocial).toBe("ACME CONSTRUÇÕES LTDA");
    expect(data.company.nomeFantasia).toBe("ACME");
    expect(data.company.cityState).toBe("SÃO PAULO - SP");
    expect(data.company.address).toBe("RUA DAS FLORES, 10");
    expect(data.workUnit.name).toBe("OBRA CENTRO");
    expect(data.workUnit.address).toBe("Rua das Obras, 5");
    expect(data.company.cnpj).toBe(content.company.cnpj);

    const tagged = buildPgrDocxData({
      ...content,
      company: { ...content.company, razaoSocial: "{{company.razaoSocial}}" },
    });
    expect(tagged.company.razaoSocial).toBe("{{company.razaoSocial}}");
  });

  it("endereço da unidade: só as linhas preenchidas, ou 'Não informado' numa linha", () => {
    const both = buildPgrDocxData(content).workUnitAddressXml;
    expect(both.match(/<w:p>/g)).toHaveLength(2);
    expect(both).toContain('w:val="PgrBody"');
    expect(both).toContain("Rua das Amostras, 250 - Jardim Exemplo");
    expect(both).toContain("Campinas - SP");

    const onlyCity = buildPgrDocxData({
      ...content,
      workUnit: { ...content.workUnit, address: " " },
    }).workUnitAddressXml;
    expect(onlyCity.match(/<w:p>/g)).toHaveLength(1);
    expect(visible(onlyCity)).toBe("Campinas - SP");

    const empty = buildPgrDocxData({
      ...content,
      workUnit: { ...content.workUnit, address: "", addressCity: "" },
    }).workUnitAddressXml;
    expect(empty.match(/<w:p>/g)).toHaveLength(1);
    expect(visible(empty)).toBe("Não informado");
  });

  it("equilibra a necessidade de controle que não cabe numa linha da coluna", () => {
    const data = buildPgrDocxData(content);
    const { controlNeed } = data.methodology;
    const certain = controlNeed.intolerable.certain;
    expect(certain).toContain("\n");
    for (const line of certain.split("\n")) {
      expect(textWidth(line, 15)).toBeLessThanOrEqual(2715);
    }
    expect(controlNeed.trivial.certain).toBe("Nenhuma ação necessária");
    expect(data.labels.controlNeedPriority).toContain("\n");
  });

  it("não mexe na necessidade de controle que o PGR já quebrou em linhas", () => {
    const data = buildPgrDocxData(content, {
      overrides: {
        methodology: {
          controlNeed: {
            ...DEFAULT_METHODOLOGY.controlNeed,
            trivial: {
              certain: "Linha um\nLinha dois",
              uncertain: "Nenhuma",
              highlyUncertain: "Nenhuma",
            },
          },
        },
      },
    });
    expect(data.methodology.controlNeed.trivial.certain).toBe("Linha um\nLinha dois");
  });

  it("título do GES duplicado é normalizado no GES e no Anexo I", () => {
    const data = buildPgrDocxData({
      ...content,
      ges: [
        { ...content.ges[0], title: "GES 1 - GES 01 - KM 10 VLT - ADMINISTRATIVO" },
        ...content.ges.slice(1),
      ],
    });
    expect(data.ges[0].title).toBe("GES 01 - KM 10 VLT - ADMINISTRATIVO");
    expect(plain(data.annexActions[0].gesTitle)).toBe(
      "GES 01 - KM 10 VLT - ADMINISTRATIVO",
    );
    for (const [title, expected] of [
      ["GES1 - OFICINA", "GES 01 - OFICINA"],
      ["GES 02 - PRODUÇÃO", "GES 02 - PRODUÇÃO"],
      ["ADMINISTRATIVO", "ADMINISTRATIVO"],
      ["GES 1 - GES Administrativo", "GES 01 - Administrativo"],
      ["GES 01 GES 01 Oficina", "GES 01 - Oficina"],
      ["GES 03 - GESTÃO DE OBRAS", "GES 03 - GESTÃO DE OBRAS"],
      ["GES 1 - GES01 - Oficina", "GES 01 - Oficina"],
      ["GES 1 - GES2 Pátio", "GES 02 - Pátio"],
    ]) {
      const { ges } = buildPgrDocxData({
        ...content,
        ges: [{ ...content.ges[0], title }],
      });
      expect(ges[0].title).toBe(expected);
    }
  });

  it("resultado e limite vazios: Não aplicável no qualitativo, Não informado nos demais", () => {
    const [risk] = content.ges[0].risks;
    const data = buildPgrDocxData({
      ...content,
      ges: [
        {
          ...content.ges[0],
          risks: [
            { ...risk, criterion: "Qualitativo", result: "", toleranceLimit: "" },
            { ...risk, criterion: "Quantitativo", result: " ", toleranceLimit: "" },
            {
              ...risk,
              criterion: "Quantitativo",
              result: "83,4 dB(A)",
              toleranceLimit: "85 dB(A)",
            },
          ],
        },
      ],
    });
    const [qualitative, quantitative, filled] = data.ges[0].risks;
    expect(qualitative.result).toBe("Não aplicável");
    expect(qualitative.toleranceLimit).toBe("Não aplicável");
    expect(quantitative.result).toBe("Não informado");
    expect(quantitative.toleranceLimit).toBe("Não informado");
    expect(filled.result).toBe("83,4 dB(A)");
    expect(filled.toleranceLimit).toBe("85 dB(A)");
  });

  it("outras características vazias viram Não informado", () => {
    const { construction } = content.ges[0];
    const empty = buildPgrDocxData({
      ...content,
      ges: [{ ...content.ges[0], construction: { ...construction, other: "" } }],
    });
    const filled = buildPgrDocxData({
      ...content,
      ges: [
        { ...content.ges[0], construction: { ...construction, other: "Piso elevado" } },
      ],
    });
    expect(empty.ges[0].construction.other).toBe("Não informado");
    expect(filled.ges[0].construction.other).toBe("Piso elevado");
  });

  it("descrição do GES cola as duas últimas palavras", () => {
    const data = buildPgrDocxData({
      ...content,
      ges: [
        {
          ...content.ges[0],
          processDescription:
            "As equipes da obra trabalham em turnos e usam sempre os equipamentos de proteção individual (EPIs).",
        },
      ],
    });
    expect(data.ges[0].processDescription).toMatch(/individual\u00a0\(EPIs\)\.$/);
  });

  it("características construtivas colam a última palavra sem levar o rótulo", () => {
    const { construction } = content.ges[0];
    const data = buildPgrDocxData({
      ...content,
      ges: [
        {
          ...content.ges[0],
          construction: {
            ...construction,
            ventilation: "Ventilação natural por meio de janelas",
            ceilingHeight: "0",
            floor: "Asfalto",
          },
        },
      ],
    });
    const built = data.ges[0].construction;
    expect(plain(built.ventilation)).toBe("Ventilação natural por meio de janelas");
    expect(built.ventilation).toMatch(/de\u00a0janelas$/);
    expect(built.ceilingHeight).toBe("0");
    expect(built.floor).toBe("Asfalto");
  });

  it("no Anexo I nenhuma linha do título do GES começa com traço", () => {
    const [ges] = content.ges;
    const { annexActions } = buildPgrDocxData({
      ...content,
      ges: [{ ...ges, title: "GES 01 - ADMINISTRATIVO DO CANTEIRO DE OBRAS" }],
    });
    for (const line of annexActions[0].gesTitle.split("\n")) {
      expect(line.trimStart().startsWith("-")).toBe(false);
    }
    expect(annexActions[0].gesTitle).toContain("01\u00a0-");
  });

  it("no Anexo I a sigla não se separa do número no título do GES", () => {
    const [ges] = content.ges;
    const { annexActions } = buildPgrDocxData({
      ...content,
      ges: [{ ...ges, title: "GES 05 - KM 120 VLT - ASG" }],
    });
    expect(annexActions[0].gesTitle).toContain("KM\u00a0120");
    expect(annexActions[0].gesTitle).toContain("GES\u00a005");
    for (const line of annexActions[0].gesTitle.split("\n")) {
      expect(line.trimStart().startsWith("-")).toBe(false);
      expect(line.trimEnd().endsWith("KM")).toBe(false);
    }
  });

  it("no Anexo I o título do GES não abre linha com barra", () => {
    const [ges] = content.ges;
    const { annexActions } = buildPgrDocxData({
      ...content,
      ges: [{ ...ges, title: "GES 02 - KM 120 VLT - ADMINISTRATIVO / OPERACIONAL" }],
    });
    for (const line of annexActions[0].gesTitle.split("\n")) {
      expect(line.trimStart().startsWith("/")).toBe(false);
    }
  });

  it("nome do risco nas medidas não separa NR do número", () => {
    const [ges] = content.ges;
    const [measure] = ges.measures;
    const data = buildPgrDocxData({
      ...content,
      ges: [
        {
          ...ges,
          measures: [
            {
              ...measure,
              riskName:
                "Exposição a ruído acima do limite de tolerância da NR 15 durante a manutenção",
            },
          ],
        },
      ],
    });
    expect(data.ges[0].measures[0].riskName).toContain("NR\u00a015");
  });

  it("frase antes da tabela de necessidade de controle fica presa à tabela", () => {
    const xml = buildPgrDocxData(content).texts.riskCategoryExample;
    const paragraphs = xml.split("<w:p>").slice(1);
    expect(paragraphs[paragraphs.length - 1]).toContain("Fundacentro");
    expect(paragraphs[paragraphs.length - 1]).toContain("<w:keepNext/>");
  });

  it("nome de função longo é equilibrado na coluna", () => {
    const [role] = content.jobRoles;
    const data = buildPgrDocxData({
      ...content,
      jobRoles: [
        { ...role, name: "TÉCNICO DE SEGURANÇA DO TRABALHO" },
        { ...role, name: "PEDREIRO" },
      ],
    });
    const [long, short] = data.jobRoles;
    expect(long.name.match(/\n/g)).toHaveLength(1);
    expect(long.name.replace("\n", " ")).toBe("TÉCNICO DE SEGURANÇA DO TRABALHO");
    for (const line of long.name.split("\n")) {
      expect(textWidth(line, 15, true)).toBeLessThanOrEqual(2300 - 140);
    }
    expect(short.name).toBe("PEDREIRO");
  });

  it("carga horária não separa o dia da semana nem começa linha com travessão", () => {
    const [role] = content.jobRoles;
    const data = buildPgrDocxData({
      ...content,
      jobRoles: [
        { ...role, workload: "Segunda-feira a Quinta-feira: 07h00min - 17h00min" },
        { ...role, workload: "Sexta-feira: 07h00min – 16h00min" },
      ],
    });
    expect(data.jobRoles[0].workload.replace(/\n/g, " ")).toBe(
      "Segunda\u2011feira a Quinta\u2011feira: 07h00min\u00A0-\u00A017h00min",
    );
    expect(data.jobRoles[1].workload.replace(/\n/g, " ")).toBe(
      "Sexta\u2011feira: 07h00min\u00A0–\u00A016h00min",
    );
    for (const { workload } of data.jobRoles) {
      for (const line of workload.split("\n")) {
        expect(line.startsWith("-") || line.startsWith("–")).toBe(false);
      }
    }
  });

  it("carga horária mantém cada intervalo de horário inteiro", () => {
    const [role] = content.jobRoles;
    const data = buildPgrDocxData({
      ...content,
      jobRoles: [
        {
          ...role,
          workload: "07h00min – 12h00min/ 13h00min – 17h00min (Segunda a Quinta-feira)",
        },
      ],
    });
    const { workload } = data.jobRoles[0];
    expect(workload).toContain("07h00min\u00A0–\u00A012h00min");
    expect(workload).toContain("13h00min\u00A0–\u00A017h00min");
    expect(workload).toContain("Quinta\u2011feira");
  });

  it("carga horária só prende o travessão entre dois horários", () => {
    const [role] = content.jobRoles;
    const data = buildPgrDocxData({
      ...content,
      jobRoles: [
        { ...role, workload: "Segunda a Sexta-feira \u2013 07h00min \u2013 17h00min" },
        { ...role, workload: "Quinta-feira - 07h00min \u2013 17h00min" },
      ],
    });
    expect(data.jobRoles[0].workload.replace(/\n/g, " ")).toBe(
      "Segunda a Sexta\u2011feira\u00A0\u2013 07h00min\u00A0\u2013\u00A017h00min",
    );
    expect(data.jobRoles[1].workload.replace(/\n/g, " ")).toBe(
      "Quinta\u2011feira\u00A0- 07h00min\u00A0\u2013\u00A017h00min",
    );
    for (const { workload } of data.jobRoles) {
      for (const token of workload.split(/[ \n]/)) {
        expect(textWidth(token, PGR_DOCX_SIZES.table)).toBeLessThanOrEqual(2500 - 140);
      }
    }
  });

  it("carga horária com quatro horários mantém cada intervalo unido e cabe na coluna", () => {
    const [role] = content.jobRoles;
    const data = buildPgrDocxData({
      ...content,
      jobRoles: [
        {
          ...role,
          workload: "Segunda a Sexta-feira: 07h00min – 11h00min – 13h00min – 17h00min",
        },
      ],
    });
    const { workload } = data.jobRoles[0];
    expect(workload).toContain("07h00min\u00A0–\u00A011h00min");
    for (const token of workload.split(/[ \n]/)) {
      expect(textWidth(token, PGR_DOCX_SIZES.table)).toBeLessThanOrEqual(2500 - 140);
    }
  });

  it("carga horária longa não deixa palavra sozinha numa linha da célula", () => {
    const [role] = content.jobRoles;
    const data = buildPgrDocxData({
      ...content,
      jobRoles: [
        {
          ...role,
          workload:
            "06h30min – 11h30min/ 12h30min – 16h30min (Segunda a Quinta-feira); 06h30min – 11h30min/ 12h30min – 15h30min (Sexta-feira); Intervalo para almoço: 01h00min",
        },
      ],
    });
    const lines = data.jobRoles[0].workload.split("\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.split(/[ \u00A0]+/).filter(Boolean).length).toBeGreaterThanOrEqual(2);
      expect(textWidth(line, PGR_DOCX_SIZES.table)).toBeLessThanOrEqual(2500 - 140);
    }
  });

  it("referência de risco em tabelas e no Anexo I fica em RISCO n", () => {
    const [ges] = content.ges;
    const data = buildPgrDocxData({
      ...content,
      ges: [
        {
          ...ges,
          actions: [{ ...ges.actions[0], riskRef: "Risco 2" }, ...ges.actions.slice(1)],
          epis: [
            {
              riskRef: "Risco 2",
              hazard: "Ruído",
              epi: "Protetor auricular",
              ca: "00002",
              neutralizes: "Sim",
            },
          ],
          measures: [
            { ...ges.measures[0], riskLabel: "Risco 2" },
            ...ges.measures.slice(1),
          ],
        },
      ],
    });
    expect(data.ges[0].actions[0].riskRef).toBe("RISCO 2");
    expect(data.ges[0].epis[0].riskRef).toBe("RISCO 2");
    expect(data.ges[0].measures[0].riskLabel).toBe("RISCO 2");
    expect(data.annexActions[0].riskRef).toBe("RISCO 2");
  });

  it("cola as duas últimas palavras de ação que sobraria sozinha na linha", () => {
    const [ges] = content.ges;
    const actionOf = (action: string) =>
      buildPgrDocxData({
        ...content,
        ges: [{ ...ges, actions: [{ ...ges.actions[0], action }] }],
      }).ges[0].actions[0].action;
    const glued = actionOf("Treinar a equipe de obra");
    expect(glued.replace(/\u00A0/g, " ")).toBe("Treinar a equipe de obra");
    expect(glued).toContain("de\u00A0obra");
    expect(actionOf("Ruído contínuo")).toBe("Ruído contínuo");
    expect(actionOf("Instalar proteção permanentemente instalada")).toBe(
      "Instalar proteção permanentemente\u00A0instalada",
    );
  });

  it("cola a última palavra quando o par cabe até 95% e sozinho sobraria na linha", () => {
    const [ges] = content.ges;
    const [action] = ges.actions;
    const width = 2341 - 140;
    const phrase =
      "verificar o uso correto dos equipamentos de proteção e registrar as ocorrências";
    const filler = phrase.split(" ");
    const words = [...filler, ...filler];
    const found = words
      .map((_, index) => `${words.slice(0, index + 1).join(" ")} norma regulamentadora.`)
      .find((candidate) => {
        const lines = wrapLines(candidate, width);
        return (
          lines.length >= 2 &&
          lines[lines.length - 1] === "regulamentadora." &&
          lines[lines.length - 2].split(" ").length >= 3
        );
      });
    expect(found).toBeDefined();

    const data = buildPgrDocxData({
      ...content,
      ges: [
        {
          ...ges,
          actions: [{ ...action, action: found ?? "" }, ...ges.actions.slice(1)],
        },
        ...content.ges.slice(1),
      ],
    });
    const glued = data.ges[0].actions[0].action;
    expect(glued.replace(/\u00A0/g, " ")).toMatch(/norma regulamentadora\.$/);
    expect(glued).toContain("norma\u00A0regulamentadora.");

    const short = buildPgrDocxData({
      ...content,
      ges: [
        { ...ges, actions: [{ ...action, action: "Aplicar norma regulamentadora." }] },
      ],
    }).ges[0].actions[0].action;
    expect(short).not.toContain("\u00A0");
  });

  it("na faixa de 70% a 95% cola o par mesmo quando a estimativa já o põe junto na última linha", () => {
    const [ges] = content.ges;
    const [action] = ges.actions;
    const width = 2341 - 140;
    const phrase =
      "verificar o uso correto dos equipamentos de proteção e registrar as ocorrências";
    const filler = phrase.split(" ");
    const words = [...filler, ...filler];
    const found = words
      .map((_, index) => `${words.slice(0, index + 1).join(" ")} norma regulamentadora.`)
      .find((candidate) => {
        const lines = wrapLines(candidate, width);
        return lines.length >= 2 && lines[lines.length - 1] === "norma regulamentadora.";
      });
    expect(found).toBeDefined();

    const data = buildPgrDocxData({
      ...content,
      ges: [
        {
          ...ges,
          actions: [{ ...action, action: found ?? "" }, ...ges.actions.slice(1)],
        },
        ...content.ges.slice(1),
      ],
    });
    const glued = data.ges[0].actions[0].action;
    expect(glued).toContain("norma\u00A0regulamentadora.");
    expect(glued.replace(/\u00A0/g, " ")).toMatch(/norma regulamentadora\.$/);
  });

  it("se a penúltima linha ficaria com uma palavra só, cola também a palavra anterior", () => {
    const [ges] = content.ges;
    const [action] = ges.actions;
    const width = 2341 - 140;
    const phrase =
      "verificar o uso correto dos equipamentos de proteção e registrar as ocorrências";
    const filler = phrase.split(" ");
    const words = [...filler, ...filler];
    const count = (line: string) => line.split(/[ \u00A0]+/).filter(Boolean).length;
    const found = words
      .map((_, index) => `${words.slice(0, index + 1).join(" ")} norma regulamentadora.`)
      .slice(4)
      .find((candidate) => {
        const once = wrapLines(candidate.replace(/ (\S+)$/, "\u00A0$1"), width);
        return once.length >= 2 && count(once[once.length - 2]) === 1;
      });
    expect(found).toBeDefined();

    const data = buildPgrDocxData({
      ...content,
      ges: [
        {
          ...ges,
          actions: [{ ...action, action: found ?? "" }, ...ges.actions.slice(1)],
        },
        ...content.ges.slice(1),
      ],
    });
    const glued = data.ges[0].actions[0].action;
    expect(glued.split("\u00A0")).toHaveLength(3);
    expect(glued.replace(/\u00A0/g, " ")).toMatch(/norma regulamentadora\.$/);
    const gluedLines = wrapLines(glued, width);
    expect(gluedLines).toHaveLength(wrapLines(found ?? "", width).length);
    expect(count(gluedLines[gluedLines.length - 2])).toBeGreaterThanOrEqual(2);
  });

  it("título de GES longo no Anexo I quebra em linhas que cabem na coluna", () => {
    const [ges] = content.ges;
    const { annexActions } = buildPgrDocxData({
      ...content,
      ges: [{ ...ges, title: "GES 01 - ADMINISTRATIVO DO CANTEIRO DE OBRAS" }],
    });
    expect(annexActions[0].gesTitle).toContain("\n");
    for (const line of annexActions[0].gesTitle.split("\n")) {
      expect(textWidth(line, PGR_DOCX_SIZES.table, true)).toBeLessThanOrEqual(1800 - 140);
    }
  });

  it("cola o rastreamento da ação e o responsável da revisão na largura da coluna", () => {
    const [ges] = content.ges;
    const data = buildPgrDocxData({
      ...content,
      revisions: [
        {
          ...content.revisions[0],
          responsible: "Engenheiro de Segurança do Trabalho Diego Exemplo",
        },
      ],
      ges: [
        {
          ...ges,
          actions: [
            {
              ...ges.actions[0],
              tracking: "Checklist semanal de proteções coletivas por pavimento.",
            },
          ],
        },
      ],
    });
    const { tracking } = data.ges[0].actions[0];
    expect(tracking).toContain("por\u00A0pavimento.");
    expect(plain(tracking)).toBe(
      "Checklist semanal de proteções coletivas por pavimento.",
    );
    expect(data.revisions[0].responsible).toContain("Diego\u00A0Exemplo");
    expect(plain(data.revisions[0].responsible)).toContain("Diego Exemplo");
  });

  it("nome do risco na tabela de medidas quebra em linhas que cabem, sem cola", () => {
    const [ges] = content.ges;
    const data = buildPgrDocxData({
      ...content,
      ges: [
        {
          ...ges,
          measures: [{ ...ges.measures[0], riskName: "Queda de diferente nível" }],
        },
      ],
    });
    const { riskName } = data.ges[0].measures[0];
    expect(riskName).toContain("\n");
    for (const line of riskName.split("\n")) {
      expect(textWidth(line, PGR_DOCX_SIZES.table)).toBeLessThanOrEqual(1500 - 140);
    }
  });

  it("monitoramento vazio na medida vira Não informado", () => {
    const [ges] = content.ges;
    const [measure] = ges.measures;
    const data = buildPgrDocxData({
      ...content,
      ges: [
        {
          ...ges,
          measures: [
            { ...measure, elimination: { ...measure.elimination, monitoring: "" } },
          ],
        },
      ],
    });
    expect(data.ges[0].measures[0].elimination.monitoring).toBe("Não informado");
  });

  it("ergonômico e psicossocial mostram o grupo de risco, nunca a unidade de medida", () => {
    const [ges] = content.ges;
    const [risk] = ges.risks;
    const [psychosocial, ergonomic, physical] = buildPgrDocxData({
      ...content,
      ges: [
        {
          ...ges,
          risks: [
            {
              ...risk,
              agentKey: "psychosocial",
              unitLabel: "UNIDADE DE MEDIDA (eSOCIAL):",
              unitValue: "0 - Não aplicável",
            },
            {
              ...risk,
              agentKey: "ergonomic",
              unitLabel: "GRUPO DE RISCO ERGONÔMICO:",
              unitValue: "Organizacional",
            },
            {
              ...risk,
              agentKey: "physical",
              unitLabel: "UNIDADE DE MEDIDA (eSOCIAL):",
              unitValue: "4 - decibel (A) (dB(A))",
            },
          ],
        },
      ],
    }).ges[0].risks;
    expect(psychosocial.unitLabel).toBe("GRUPO DE RISCO ERGONÔMICO:");
    expect(psychosocial.unitValue).toBe("Não informado");
    expect(ergonomic.unitLabel).toBe("GRUPO DE RISCO ERGONÔMICO:");
    expect(ergonomic.unitValue).toBe("Organizacional");
    expect(physical.unitLabel).toBe("UNIDADE DE MEDIDA (eSOCIAL):");
    expect(physical.unitValue).toBe("4 - decibel (A) (dB(A))");
  });

  it("função de topo: uma parte só quando a descrição cabe em poucas linhas", () => {
    const [role] = content.jobRoles;
    const data = buildPgrDocxData({
      ...content,
      jobRoles: [
        { ...role, description: "Executa alvenaria e reboco." },
        { ...role, description: "palavra ".repeat(400) },
      ],
    });
    const [short, long] = data.jobRoles;
    expect(short.parts).toHaveLength(1);
    expect(short.parts[0].last).toBe(true);
    expect(short.parts[0].description).toBe(short.description);
    expect(long.parts.length).toBeGreaterThan(1);
    const [first, ...rest] = long.parts;
    expect(first.name).toBe(long.name);
    expect(first.workload).toBe(long.workload);
    expect(first.employeeCount).toBe(role.employeeCount);
    for (const part of rest) {
      expect(part.name).toBe("");
      expect(part.workload).toBe("");
      expect(part.employeeCount).toBe("");
    }
    expect(long.parts.map((part) => part.last)).toEqual(
      long.parts.map((_, index) => index === long.parts.length - 1),
    );
    expect(
      long.parts
        .map((part) => part.description)
        .join(" ")
        .replace(/\n/g, " "),
    ).toBe(long.description);
    expect("keepWhole" in short).toBe(false);
  });

  it("descrição da função: cada linha da parte vira <w:br/> no XML", () => {
    const [role] = content.jobRoles;
    const [long] = buildPgrDocxData({
      ...content,
      jobRoles: [{ ...role, description: "palavra ".repeat(400) }],
    }).jobRoles;
    expect(long.parts.length).toBeGreaterThan(1);
    for (const part of long.parts) {
      expect(part.descriptionXml.startsWith("<w:p>")).toBe(true);
      expect(part.descriptionXml.split("<w:br/>")).toHaveLength(
        part.description.split("\n").length,
      );
    }
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
