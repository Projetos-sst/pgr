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
        actionHow: "Distribuição mensal",
        actionTracking: null,
        actionMeasurement: null,
        actionResponsible: "SESMT",
        actionDeadline: "2026-08-01",
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

  it("não renderiza a linha de site quando companyWebsite ausente", () => {
    const html = buildPgrHtml(makePgr([]), baseOptions);
    expect(html).not.toContain("<td>Site</td>");
  });

  it("renderiza a linha de site quando companyWebsite preenchido", () => {
    const pgrWithWebsite = makePgr([]);
    pgrWithWebsite.pgr.companyWebsite = "https://www.acme.com.br";
    const html = buildPgrHtml(pgrWithWebsite, baseOptions);
    expect(html).toContain("<td>Site</td>");
    expect(html).toContain("https://www.acme.com.br");
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
