import type { ClassificationBand } from "@/shared/domains/pgr/methodology";
import type {
  ConsolidatedMeasure,
  ConsolidatedRisk,
  PgrConsolidated,
} from "@/shared/domains/pgr/pgr-consolidated";
import {
  buildPgrDocxContent,
  formatDocxDate,
  formatValidity,
  riskLevelText,
  type PgrDocxExtras,
} from "@/shared/domains/pgr/pgr-docx/from-consolidated";

const address = {
  zipCode: "13000-000",
  street: "Av Exemplo",
  number: "100",
  complement: null,
  district: "Centro",
  city: "Campinas",
  state: "SP",
};

function measure(overrides: Partial<ConsolidatedMeasure>): ConsolidatedMeasure {
  return {
    id: "m",
    controlLevel: "collective_protection",
    applicable: true,
    status: null,
    justification: null,
    monitoring: null,
    actionWhat: null,
    actionWhy: null,
    actionHow: null,
    actionTracking: null,
    actionMeasurement: null,
    actionResponsible: null,
    actionDeadline: null,
    actionCost: null,
    state: "without_plan",
    ...overrides,
  };
}

const noise: ConsolidatedRisk = {
  id: "r1",
  agentType: "physical",
  description: "Ruído de betoneira",
  hazard: "RUÍDO",
  sources: "Betoneira",
  propagation: "Ar",
  exposureTime: "4_7h",
  possibleInjuries: "PAIR",
  noxiousAgentCode: "02.01.001",
  measurementUnit: "db_a",
  concentrationIntensity: null,
  riskLevel: 6,
  result: "tolerable",
  assessment: {
    criterion: "quantitative",
    probability: 3,
    severity: 2,
    riskLevel: 6,
    uncertaintyDegree: 1,
    toleranceLimit: null,
    result: "tolerable",
    assessedAt: "2026-09-01",
    evaluationMethod: "Dosimetria",
    measuredValue: "83.4",
    measuredUnit: "db_a",
    toleranceLimitValue: "85",
    nr09Conclusion: null,
  },
  measures: [
    measure({
      controlLevel: "elimination",
      applicable: false,
      justification: "Inviável",
    }),
    measure({
      actionWhat: "Enclausurar a betoneira",
      monitoring: "Dosimetria anual",
      actionTracking: "Checklist",
      actionMeasurement: "dB(A) medido",
      actionResponsible: "SESMT",
      actionDeadline: "2027-03-30",
      state: "planned",
    }),
  ],
  planCoverage: "covered",
  epis: [
    {
      id: "e1",
      catalogId: "c1",
      name: "Protetor auricular",
      ca: "12345",
      neutralization: "neutralizes",
    },
  ],
};

const fall: ConsolidatedRisk = {
  ...noise,
  id: "r2",
  agentType: "mechanical",
  description: "Queda de altura",
  hazard: null,
  sources: null,
  propagation: null,
  exposureTime: null,
  possibleInjuries: null,
  noxiousAgentCode: null,
  measurementUnit: null,
  riskLevel: null,
  result: null,
  assessment: null,
  measures: [],
  epis: [],
};

const data: PgrConsolidated = {
  pgr: {
    id: "pgr-1",
    companyName: "Construtora Exemplo",
    workUnitName: "Obra 1",
    responsible: "Eng. Fulano",
    registrationType: "crea",
    registrationNumber: "123/SP",
    issuedAt: "2026-10-01",
    validUntil: "2028-09-30",
    company: {
      razaoSocial: "CONSTRUTORA EXEMPLO LTDA",
      nomeFantasia: "EXEMPLO",
      cnpj: "11222333000181",
      cnae: "41.20-4-00",
      mainActivity: "Construção de edifícios",
      riskGrade: 3,
      website: null,
      address,
    },
    workUnit: {
      name: "Obra 1",
      type: "site",
      contractNumber: "CT-1",
      managerName: "Preposto",
      managerRole: null,
      professionalTitle: null,
      professionalRegistration: null,
      startDate: "2026-10-01",
      expectedEndDate: "2027-12-31",
      address,
    },
  },
  ges: [{ id: "g1", name: "ESTRUTURA", risks: [noise, fall] }],
};

const extras: PgrDocxExtras = {
  company: { phone: "(19) 3000-0000", logoPath: null },
  revisions: [],
  ges: {
    g1: {
      processDescription: "Concretagem",
      constructionType: null,
      ceilingHeight: "2.80",
      floor: "Concreto",
      roof: null,
      lighting: null,
      ventilation: null,
      otherCharacteristics: null,
      jobRoles: [
        {
          id: "j2",
          title: "SERVENTE",
          description: null,
          workSchedule: null,
          workerCount: 4,
        },
        {
          id: "j1",
          title: "PEDREIRO",
          description: "Assenta",
          workSchedule: "07h-17h",
          workerCount: 6,
        },
      ],
    },
  },
  requiredTrainings: [
    { jobRoleId: "j1", trainingId: "t1", label: "NR 35" },
    { jobRoleId: "j2", trainingId: "t2", label: "NR 18" },
    { jobRoleId: "j1", trainingId: "t2", label: "NR 18" },
    { jobRoleId: "outro", trainingId: "t9", label: "NR 10" },
  ],
};

const content = buildPgrDocxContent(data, extras, { emittedAt: "02/10/2026 09:30" });

const fundacentro: ClassificationBand[] = [
  { classification: "trivial", maxLevel: 2 },
  { classification: "tolerable", maxLevel: 6 },
  { classification: "moderate", maxLevel: 12 },
  { classification: "substantial", maxLevel: 20 },
  { classification: "intolerable", maxLevel: 25 },
];

describe("formatadores", () => {
  it("datas no padrão do documento", () => {
    expect(formatDocxDate("2026-10-01")).toBe("01-10-2026");
    expect(formatDocxDate("2026-10-01", "/")).toBe("01/10/2026");
    expect(formatDocxDate(null)).toBe("");
    expect(formatValidity("2026-10-01", "2028-09-30")).toBe("10/2026 a 09/2028");
    expect(formatValidity(null, "2028-09-30")).toBe("09/2028");
  });

  it("nível de risco com a faixa da matriz", () => {
    expect(riskLevelText({ result: "substantial" })).toBe("Substancial (10-15)");
    expect(riskLevelText({ result: null })).toBe("Não avaliado");
  });

  it("nível de risco com as faixas da metodologia da organização", () => {
    expect(riskLevelText({ result: "trivial" }, fundacentro)).toBe("Trivial (1-2)");
    expect(riskLevelText({ result: "moderate" }, fundacentro)).toBe("Moderado (7-12)");
    expect(riskLevelText({ result: "intolerable" }, fundacentro)).toBe(
      "Intolerável (21-25)",
    );
    expect(riskLevelText({ result: null }, fundacentro)).toBe("Não avaliado");
  });
});

describe("buildPgrDocxContent", () => {
  it("identificação da empresa, obra e responsáveis", () => {
    expect(content.validity).toBe("10/2026 a 09/2028");
    expect(content.company).toMatchObject({
      razaoSocial: "CONSTRUTORA EXEMPLO LTDA",
      cnpj: "11.222.333/0001-81",
      cnae: "41.20-4-00 (Construção de edifícios)",
      cityState: "CAMPINAS - SP",
      address: "Av Exemplo, 100 - Centro | Campinas - SP",
      phone: "(19) 3000-0000",
      riskGrade: "3",
      stateRegistration: "",
    });
    expect(content.responsibles).toMatchObject({
      author: "Eng. Fulano",
      authorRegistration: "123/SP",
      registrationType: "CREA",
    });
    expect(content.contract).toMatchObject({
      number: "CT-1",
      agent: "Preposto",
      term: "01/10/2026 a 31/12/2027",
      employees: "10",
    });
  });

  it("sem número de contrato o bloco do contrato fica vazio (some no template)", () => {
    const withoutContract = buildPgrDocxContent(
      {
        ...data,
        pgr: { ...data.pgr, workUnit: { ...data.pgr.workUnit!, contractNumber: null } },
      },
      extras,
      { emittedAt: "x" },
    );
    expect(Object.values(withoutContract.contract).every((value) => value === "")).toBe(
      true,
    );
  });

  it("quadro de funções ordenado, com total, sem inventar revisão não cadastrada", () => {
    expect(content.jobRoles.map((role) => [role.name, role.employeeCount])).toEqual([
      ["PEDREIRO", "6"],
      ["SERVENTE", "4"],
    ]);
    expect(content.jobRolesTotal).toBe("10");
    expect(content.cipa).toEqual({ riskGrade: "3", employeeCount: "10" });
    expect(content.revisions).toEqual([]);
  });

  it("sem funções nos GES: total 0 e nenhum número inventado para a CIPA", () => {
    const empty = buildPgrDocxContent(
      data,
      { ...extras, ges: { g1: { ...extras.ges.g1, jobRoles: [] } } },
      { emittedAt: "x" },
    );
    expect(empty.jobRoles).toEqual([]);
    expect(empty.jobRolesTotal).toBe("0");
    expect(empty.cipa?.employeeCount).toBeUndefined();
    expect(empty.contract.employees).toBe("");
  });

  it("GES sem extras: descrição 'Não informado'", () => {
    const withoutExtras = buildPgrDocxContent(
      data,
      { ...extras, ges: {} },
      { emittedAt: "x" },
    );
    expect(withoutExtras.ges[0].processDescription).toBe("Não informado");
    expect(content.ges[0].processDescription).toBe("Concretagem");
  });

  it("título do GES com 2 dígitos e em caixa alta, sem repetir o prefixo", () => {
    const named = buildPgrDocxContent(
      {
        ...data,
        ges: [
          { id: "g1", name: "Estrutura e alvenaria", risks: [] },
          { id: "g2", name: "ges 02 - Frente de serviço", risks: [] },
          { id: "g3", name: "Gestão administrativa", risks: [] },
        ],
      },
      extras,
      { emittedAt: "x" },
    );
    expect(named.ges.map((ges) => ges.title)).toEqual([
      "GES 01 - ESTRUTURA E ALVENARIA",
      "GES 02 - FRENTE DE SERVIÇO",
      "GES 03 - GESTÃO ADMINISTRATIVA",
    ]);
  });

  it("título do GES com número no nome: nunca repete o prefixo GES", () => {
    const numbered = buildPgrDocxContent(
      {
        ...data,
        ges: [
          { id: "g1", name: "Oficina", risks: [] },
          { id: "g2", name: "GES1 - Oficina", risks: [] },
          { id: "g3", name: "Gestão de obras", risks: [] },
          { id: "g4", name: "GES01 Oficina", risks: [] },
          { id: "g5", name: "GES 01 - GES 01 - Oficina", risks: [] },
          { id: "g6", name: "GES 5", risks: [] },
          { id: "g7", name: "GES 1 - GES Administrativo", risks: [] },
          { id: "g8", name: "GES 01 GES 01 Oficina", risks: [] },
          { id: "g9", name: "GES 2 - GES 02 - Pátio", risks: [] },
        ],
      },
      { ...extras, ges: {} },
      { emittedAt: "x" },
    );
    expect(numbered.ges.map((ges) => ges.title)).toEqual([
      "GES 01 - OFICINA",
      "GES 01 - OFICINA",
      "GES 03 - GESTÃO DE OBRAS",
      "GES 01 - OFICINA",
      "GES 01 - OFICINA",
      "GES 05",
      "GES 01 - ADMINISTRATIVO",
      "GES 01 - OFICINA",
      "GES 02 - PÁTIO",
    ]);
  });

  it("título do GES com GES colado ao número não se repete", () => {
    const glued = buildPgrDocxContent(
      {
        ...data,
        ges: [
          { id: "h1", name: "GES 1 - GES01 - Oficina", risks: [] },
          { id: "h2", name: "GES 1 - GES2 Pátio", risks: [] },
          { id: "h3", name: "Gestão de obras", risks: [] },
        ],
      },
      { ...extras, ges: {} },
      { emittedAt: "x" },
    );
    expect(glued.ges.map((ges) => ges.title)).toEqual([
      "GES 01 - OFICINA",
      "GES 02 - PÁTIO",
      "GES 03 - GESTÃO DE OBRAS",
    ]);
  });

  it("matriz de treinamento só com funções do PGR", () => {
    expect(content.trainingMatrix).toEqual({
      columns: ["NR 35", "NR 18"],
      rows: [
        { name: "PEDREIRO", marks: [true, true] },
        { name: "SERVENTE", marks: [false, true] },
      ],
    });
  });

  it("risco avaliado no vocabulário do documento", () => {
    const [ges] = content.ges;
    expect(ges.title).toBe("GES 01 - ESTRUTURA");
    expect(ges.construction.ceilingHeight).toBe("2,80");
    expect(ges.construction.roof).toBe("Não informado");
    expect(ges.risks[0]).toMatchObject({
      number: 1,
      agentType: "Físico",
      agentKey: "physical",
      riskLevel: "Tolerável (3-8)",
      riskClass: "tolerable",
      criterion: "Quantitativo",
      unitLabel: "UNIDADE DE MEDIDA (eSOCIAL):",
      unitValue: "4 - decibel (A) (dB(A))",
      uncertainty: "1 - Incerta",
      probability: "3 - Exposição moderada",
      severity: "2 - Lesão ou doenças sérias reversíveis",
      controlNeed: "Informação adicional necessária",
      result: "83,4 dB(A)",
      toleranceLimit: "85 dB(A)",
    });
    expect(ges.risks[0]).not.toHaveProperty("assessmentDetails");
  });

  it("unidade do eSocial com código e grupo ergonômico sem a unidade de medida", () => {
    const vibration: ConsolidatedRisk = {
      ...noise,
      id: "r3",
      measurementUnit: "qualitative_na",
      concentrationIntensity: "0.45",
      assessment: null,
    };
    const posture: ConsolidatedRisk = {
      ...noise,
      id: "r4",
      agentType: "ergonomic",
      measurementUnit: "qualitative_na",
    };
    const psychosocial: ConsolidatedRisk = {
      ...noise,
      id: "r5",
      agentType: "psychosocial",
      measurementUnit: null,
    };
    const accelerated: ConsolidatedRisk = {
      ...noise,
      id: "r6",
      measurementUnit: "m_s2",
      concentrationIntensity: "1.25",
      assessment: null,
    };
    const [ges] = buildPgrDocxContent(
      {
        ...data,
        ges: [
          { id: "g1", name: "X", risks: [vibration, posture, psychosocial, accelerated] },
        ],
      },
      extras,
      { emittedAt: "x" },
    ).ges;
    expect(ges.risks.map((risk) => [risk.unitLabel, risk.unitValue])).toEqual([
      ["UNIDADE DE MEDIDA (eSOCIAL):", "0 - Não aplicável"],
      ["GRUPO DE RISCO ERGONÔMICO:", "Não informado"],
      ["GRUPO DE RISCO ERGONÔMICO:", "Não informado"],
      ["UNIDADE DE MEDIDA (eSOCIAL):", "5 - metro por segundo ao quadrado (m/s²)"],
    ]);
    expect(ges.risks[0].result).toBe("0,45");
    expect(ges.risks[3].result).toBe("1,25 m/s²");
  });

  it("registro antigo com unidade fora do catálogo do grupo sai no documento como foi gravado", () => {
    const legacy: ConsolidatedRisk = {
      ...noise,
      id: "r7",
      agentType: "chemical",
      hazard: "Tinta",
      measurementUnit: "lux",
      concentrationIntensity: "320",
      assessment: null,
    };
    const [ges] = buildPgrDocxContent(
      { ...data, ges: [{ id: "g1", name: "X", risks: [legacy] }] },
      extras,
      { emittedAt: "x" },
    ).ges;
    expect(ges.risks[0]).toMatchObject({
      agentType: "Químico",
      hazard: "Tinta",
      unitValue: "13 - lux (lx)",
      result: "320 lux",
    });
  });

  it("faixas da metodologia da organização no selo e no plano de ação", () => {
    const withBands = buildPgrDocxContent(data, extras, {
      emittedAt: "x",
      classificationBands: fundacentro,
    });
    expect(withBands.classificationBands).toEqual(fundacentro);
    expect(withBands.ges[0].risks[0]).toMatchObject({
      riskLevel: "Tolerável (3-6)",
      riskClass: "tolerable",
    });
    expect(withBands.ges[0].actions[0].riskLevel).toBe("Tolerável (3-6)");
    expect(content).not.toHaveProperty("classificationBands");
  });

  it("risco sem avaliação não inventa classificação", () => {
    const risk = content.ges[0].risks[1];
    expect(risk).toMatchObject({
      agentType: "Mecânicos/Acidentes",
      agentKey: "accident",
      riskLevel: "Não avaliado",
      riskClass: null,
      hazard: "Não informado",
      propagation: "Não informado",
      probability: "Não avaliado",
      controlNeed: "Não avaliado",
    });
  });

  it("medidas pelos 5 níveis da hierarquia, EPIs e plano de ação", () => {
    const [ges] = content.ges;
    expect(ges.measures[0]).toEqual({
      riskLabel: "RISCO 1",
      riskName: "Ruído de betoneira",
      elimination: { applies: "Não", measures: "Inviável", monitoring: "" },
      substitution: {
        applies: "—",
        measures: "Não informado",
        monitoring: "",
      },
      collective: {
        applies: "Sim",
        measures: "Enclausurar a betoneira",
        monitoring: "Dosimetria anual",
      },
      administrative: {
        applies: "—",
        measures: "Não informado",
        monitoring: "",
      },
      individual: {
        applies: "—",
        measures: "Não informado",
        monitoring: "",
      },
    });
    expect(ges.epis).toEqual([
      {
        riskRef: "RISCO 1",
        hazard: "RUÍDO",
        epi: "Protetor auricular",
        ca: "12345",
        neutralizes: "Sim",
      },
    ]);
    expect(ges.actions).toEqual([
      {
        riskRef: "RISCO 1",
        occupationalRisk: "Ruído de betoneira",
        riskLevel: "Tolerável (3-8)",
        action: "Enclausurar a betoneira",
        tracking: "Checklist",
        measurement: "dB(A) medido",
        responsible: "SESMT",
        deadline: "30-03-2027",
        status: "Planejada",
      },
    ]);
  });
});
