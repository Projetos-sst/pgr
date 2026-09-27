import {
  buildPgrHtml,
  DEFAULT_COVER_COLOR,
  type PgrPdfOptions,
} from "@/shared/domains/pgr/pgr-pdf-template";
import type {
  ConsolidatedGes,
  ConsolidatedRisk,
  PgrConsolidated,
} from "@/shared/domains/pgr/pgr-consolidated";

const baseOptions: PgrPdfOptions = { generatedAt: "2026-07-19" };

function makeRisk(overrides: Partial<ConsolidatedRisk> = {}): ConsolidatedRisk {
  return {
    id: "risk-1",
    agentType: "chemical",
    description: "Poeira mineral",
    hazard: null,
    sources: "Corte de rocha",
    propagation: null,
    exposureTime: null,
    possibleInjuries: null,
    noxiousAgentCode: null,
    measurementUnit: null,
    concentrationIntensity: null,
    riskLevel: 12,
    result: "substantial",
    assessment: {
      criterion: "quantitative",
      probability: 4,
      severity: 3,
      riskLevel: 12,
      uncertaintyDegree: 0,
      toleranceLimit: null,
      result: "substantial",
      assessedAt: "2026-06-01",
      evaluationMethod: null,
      measuredValue: null,
      measuredUnit: null,
      toleranceLimitValue: null,
      nr09Conclusion: null,
    },
    measures: [
      {
        id: "m-1",
        controlLevel: "ppe",
        applicable: true,
        status: "introduced",
        justification: null,
        monitoring: null,
        actionWhat: "Fornecer respirador PFF2",
        actionWhy: null,
        actionHow: "Distribuição mensal",
        actionTracking: null,
        actionMeasurement: null,
        actionResponsible: "SESMT",
        actionDeadline: "2026-08-01",
        actionCost: null,
        state: "planned",
      },
    ],
    planCoverage: "covered",
    epis: [],
    ...overrides,
  };
}

function makePgr(ges: ConsolidatedGes[]): PgrConsolidated {
  return {
    pgr: {
      id: "pgr-1",
      companyName: "ACME Ltda",
      workUnitName: "Obra Central",
      responsible: "Eng. Fulano",
      registrationType: "crea",
      registrationNumber: "12345",
      issuedAt: "2026-01-10",
      validUntil: "2027-01-10",
    },
    ges,
  };
}

/** Só o bloco da capa — o resto do documento tem suas próprias seções (#47). */
function coverOf(html: string): string {
  const start = html.indexOf('<section class="cover">');
  const end = html.indexOf("</section>", start);
  return html.slice(start, end);
}

/** PGR com identificação completa (#47, seção 1). */
function makePgrFull(ges: ConsolidatedGes[]): PgrConsolidated {
  const base = makePgr(ges);
  base.pgr.company = {
    razaoSocial: "ACME Ltda",
    nomeFantasia: "ACME",
    cnpj: "11222333000181",
    cnae: "4120-4/00",
    mainActivity: "Construção de edifícios",
    riskGrade: 3,
    website: "https://www.acme.com.br",
    address: {
      zipCode: "20040-020",
      street: "Avenida Rio Branco",
      number: "156",
      complement: null,
      district: "Centro",
      city: "Rio de Janeiro",
      state: "RJ",
    },
  };
  base.pgr.workUnit = {
    name: "Obra Central",
    type: "site",
    contractNumber: "CT-2026/001",
    managerName: "Fulano Preposto",
    managerRole: "Encarregado de obra",
    professionalTitle: "Engenheiro Civil",
    professionalRegistration: "CREA-RJ 99999",
    startDate: "2026-01-02",
    expectedEndDate: "2027-01-02",
    address: {
      zipCode: "20040-020",
      street: "Avenida Rio Branco",
      number: "156",
      complement: "Canteiro",
      district: "Centro",
      city: "Rio de Janeiro",
      state: "RJ",
    },
  };
  return base;
}

describe("PDF do PGR — estrutura de seções (#47)", () => {
  it("monta as seções na ordem e numeradas sequencialmente", () => {
    const html = buildPgrHtml(makePgrFull([]), baseOptions);
    const order = [
      "1. Identificação",
      "2. Inventário de riscos (NR-01)",
      "3. Avaliação quantitativa de agentes (NR-09)",
      "4. Plano de ação (5W2H)",
      "5. Hierarquia de controles (NR-01)",
    ];
    const positions = order.map((title) => html.indexOf(title));
    expect(positions.every((pos) => pos > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("sumário lista exatamente as seções ligadas", () => {
    const html = buildPgrHtml(makePgrFull([]), {
      ...baseOptions,
      sections: { nr09: false, controlHierarchy: false },
    });
    expect(html).toContain("<li>Identificação</li>");
    expect(html).not.toContain("<li>Avaliação quantitativa de agentes (NR-09)</li>");
    expect(html).not.toContain("3. Avaliação quantitativa de agentes (NR-09)");
    // Com a NR-09 desligada, o plano de ação vira a seção 3.
    expect(html).toContain("3. Plano de ação (5W2H)");
  });

  it("não traz seção NR-17: ela depende da #40 e não é simulada", () => {
    const html = buildPgrHtml(makePgrFull([]), baseOptions);
    expect(html).not.toContain("NR-17");
    expect(html).not.toContain("Ergonom");
  });

  it("identificação imprime empresa, obra, responsável técnico e preposto", () => {
    const html = buildPgrHtml(makePgrFull([]), baseOptions);
    expect(html).toContain("11222333000181");
    expect(html).toContain("Avenida Rio Branco, 156");
    expect(html).toContain("Fulano Preposto");
    expect(html).toContain("Encarregado de obra");
    expect(html).toContain("CREA · 12345");
  });

  it("identificação mostra ausência honesta quando o cadastro está vazio", () => {
    const html = buildPgrHtml(makePgr([]), baseOptions);
    expect(html).toContain("não informado");
    expect(html).not.toContain("Responsável não definido");
    expect(html).not.toContain("Ambiente não informado");
  });

  it("NR-09 imprime medição da avaliação vigente e ignora agente não elegível", () => {
    const quimico = makeRisk({
      id: "r-quimico",
      agentType: "chemical",
      description: "Poeira de sílica",
      assessment: {
        criterion: "quantitative",
        probability: 4,
        severity: 3,
        riskLevel: 12,
        uncertaintyDegree: 0,
        toleranceLimit: "NR-15 Anexo 12",
        result: "substantial",
        assessedAt: "2026-09-20",
        evaluationMethod: "NHO-08",
        measuredValue: "3.2",
        measuredUnit: "mg_m3",
        toleranceLimitValue: "2",
        nr09Conclusion: "above_limit",
      },
    });
    const ergonomico = makeRisk({
      id: "r-ergo",
      agentType: "ergonomic",
      description: "Postura em bancada",
    });
    const html = buildPgrHtml(
      makePgrFull([{ id: "ges-1", name: "GES Corte", risks: [quimico, ergonomico] }]),
      baseOptions,
    );
    expect(html).toContain("NHO-08");
    expect(html).toContain("3.2 mg/m³");
    expect(html).toContain("Acima do limite de tolerância");
    expect(html).toContain("1 risco(s) deste GES não são objeto da NR-09");
  });

  it("NR-09: risco elegível sem medição sai como pendente, nunca como conforme", () => {
    const semMedicao = makeRisk({
      id: "r-fisico",
      agentType: "physical",
      assessment: null,
    });
    const html = buildPgrHtml(
      makePgrFull([{ id: "ges-1", name: "GES Solda", risks: [semMedicao] }]),
      baseOptions,
    );
    expect(html).toContain("Sem medição registrada");
    expect(html).not.toContain("Abaixo do limite de tolerância");
  });

  it("plano de ação imprime os 7 elementos do 5W2H com dado real", () => {
    const risco = makeRisk({
      id: "r-plano",
      agentType: "physical",
      measures: [
        {
          id: "m-1",
          controlLevel: "collective_protection",
          applicable: true,
          status: "introduced",
          justification: null,
          monitoring: null,
          actionWhat: "Enclausurar o compressor",
          actionWhy: "Exposição acima do limite na NHO-01",
          actionHow: "Cabine acústica",
          actionTracking: null,
          actionMeasurement: null,
          actionResponsible: "Eng. de Segurança",
          actionDeadline: "2026-12-31",
          actionCost: "15000.00",
          state: "planned",
        },
      ],
    });
    const html = buildPgrHtml(
      makePgrFull([{ id: "ges-1", name: "GES Compressores", risks: [risco] }]),
      baseOptions,
    );
    for (const header of [
      "<th>O quê</th>",
      "<th>Por quê</th>",
      "<th>Onde</th>",
      "<th>Quando</th>",
      "<th>Quem</th>",
      "<th>Como</th>",
      "<th>Quanto</th>",
    ]) {
      expect(html).toContain(header);
    }
    expect(html).toContain("Exposição acima do limite na NHO-01");
    expect(html).toContain("GES Compressores");
    expect(html).toContain("15.000,00");
  });

  it("plano de ação: medida sem por quê/custo mostra ausência, não texto da ponte #51", () => {
    const risco = makeRisk({
      id: "r-plano-2",
      agentType: "physical",
      measures: [
        {
          id: "m-2",
          controlLevel: "ppe",
          applicable: true,
          status: "maintain",
          justification: null,
          monitoring: null,
          actionWhat: "Protetor auricular",
          actionWhy: null,
          actionHow: "Entrega com treinamento",
          actionTracking: null,
          actionMeasurement: null,
          actionResponsible: null,
          actionDeadline: null,
          actionCost: null,
          state: "without_plan",
        },
      ],
    });
    const html = buildPgrHtml(
      makePgrFull([{ id: "ges-1", name: "GES Ruído", risks: [risco] }]),
      baseOptions,
    );
    expect(html).toContain("não informado");
    expect(html).not.toContain("Responsável não definido");
    expect(html).not.toContain("Medida de controle nível");
  });

  it("inventário imprime referências (eSocial/unidade/LT), EPIs e cobertura do plano", () => {
    const risco = makeRisk({
      id: "r-inv",
      agentType: "chemical",
      noxiousAgentCode: "02.01.014",
      measurementUnit: "mg_m3",
      concentrationIntensity: "1.5",
      planCoverage: "covered",
      epis: [
        {
          id: "e-1",
          catalogId: "c-1",
          name: "Respirador PFF2",
          ca: "12345",
          neutralization: "neutralizes",
        },
      ],
    });
    const html = buildPgrHtml(
      makePgrFull([{ id: "ges-1", name: "GES Corte", risks: [risco] }]),
      baseOptions,
    );
    expect(html).toContain("eSocial 02.01.014");
    expect(html).toContain("1.5 mg/m³");
    expect(html).toContain("Respirador PFF2 (CA 12345)");
    expect(html).toContain("Coberto");
  });
});

describe("buildPgrHtml", () => {
  it("usa a cor default quando nenhuma é informada", () => {
    const html = buildPgrHtml(makePgr([]), baseOptions);
    expect(html).toContain(DEFAULT_COVER_COLOR);
    expect(html).toContain("ACME Ltda");
    expect(html).toContain("Programa de Gerenciamento de Riscos");
  });

  it("aplica a cor parametrizada na capa", () => {
    const html = buildPgrHtml(makePgr([]), { ...baseOptions, coverColor: "#ff0000" });
    expect(html).toContain("#ff0000");
    expect(html).not.toContain(DEFAULT_COVER_COLOR);
  });

  it("renderiza empty-state quando o PGR não tem GES", () => {
    const html = buildPgrHtml(makePgr([]), baseOptions);
    expect(html).toContain("PGR sem GES cadastrados.");
  });

  it("renderiza empty-state de riscos para GES sem riscos", () => {
    const html = buildPgrHtml(
      makePgr([{ id: "g1", name: "Escritório", risks: [] }]),
      baseOptions,
    );
    expect(html).toContain("GES sem riscos.");
  });

  it("inclui inventário, plano de ação e hierarquia quando há riscos", () => {
    const html = buildPgrHtml(
      makePgr([{ id: "g1", name: "Marmoraria", risks: [makeRisk()] }]),
      baseOptions,
    );
    expect(html).toContain("Inventário de riscos");
    expect(html).toContain("Poeira mineral");
    expect(html).toContain("Plano de ação");
    expect(html).toContain("Fornecer respirador PFF2");
    expect(html).toContain("Hierarquia de controles");
  });

  it("omite seções desabilitadas", () => {
    const html = buildPgrHtml(
      makePgr([{ id: "g1", name: "Marmoraria", risks: [makeRisk()] }]),
      { ...baseOptions, sections: { actionPlan: false, controlHierarchy: false } },
    );
    expect(html).toContain("Inventário de riscos");
    expect(html).not.toContain("Plano de ação");
    expect(html).not.toContain("Hierarquia de controles");
  });

  it("renderiza o cabeçalho de controle de formulário quando informado", () => {
    const html = buildPgrHtml(makePgr([]), {
      ...baseOptions,
      formHeader: {
        code: "FRM-001",
        revision: "02",
        date: "2026-07-19",
        nonConformity: "N/A",
      },
    });
    expect(html).toContain("FRM-001");
    expect(html).toContain("REV:");
    expect(html).toContain("N.C.:");
  });

  it("capa não renderiza a linha de site quando companyWebsite ausente", () => {
    // A capa continua omitindo a linha (#5). A seção 1 (#47) mostra o campo como
    // "não informado" — ali a ausência é informação, não ruído.
    const cover = coverOf(buildPgrHtml(makePgr([]), baseOptions));
    expect(cover).not.toContain("<td>Site</td>");
  });

  it("capa renderiza a linha de site quando companyWebsite preenchido", () => {
    const pgrWithWebsite = makePgr([]);
    pgrWithWebsite.pgr.companyWebsite = "https://www.acme.com.br";
    const cover = coverOf(buildPgrHtml(pgrWithWebsite, baseOptions));
    expect(cover).toContain("<td>Site</td>");
    expect(cover).toContain("https://www.acme.com.br");
  });

  it("não renderiza logo quando ausente e renderiza quando data URL fornecida", () => {
    const withoutLogo = buildPgrHtml(makePgr([]), baseOptions);
    expect(withoutLogo).not.toContain('<img class="logo"');
    const withLogo = buildPgrHtml(makePgr([]), {
      ...baseOptions,
      logoDataUrl: "data:image/png;base64,AAAA",
    });
    expect(withLogo).toContain('<img class="logo"');
  });
});
