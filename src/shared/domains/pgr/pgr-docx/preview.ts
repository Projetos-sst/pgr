import type { PgrDocxContent, PgrDocxMeasureLevel, PgrDocxRisk } from "./content";
import type { PgrDocxTemplateData } from "./build-data";

/**
 * Conteúdo de PRÉVIA do template anotado: cada campo dinâmico vale a própria tag que o
 * template usa naquele ponto (`{{company.razaoSocial}}`, `{{hazard}}` dentro do loop de
 * riscos…), com um item de exemplo em cada lista. Renderizado sobre o template anotado,
 * produz o espelho do PGR 2026.1: fixo em amarelo, semi-fixo com o default em laranja,
 * dinâmico como `{{tag}}`.
 */

const tag = (path: string) => `{{${path}}}`;

function level(prefix: string): PgrDocxMeasureLevel {
  return {
    applies: tag(`${prefix}.applies`),
    measures: tag(`${prefix}.measures`),
    monitoring: tag(`${prefix}.monitoring`),
  };
}

const RISK_FIELDS = [
  "agentType",
  "riskLevel",
  "hazard",
  "risk",
  "sources",
  "propagation",
  "exposureTime",
  "injuries",
  "criterion",
  "esocialCode",
  "unitLabel",
  "unitValue",
  "uncertainty",
  "probability",
  "severity",
  "controlNeed",
  "result",
  "toleranceLimit",
] as const satisfies readonly (keyof PgrDocxRisk)[];

export function buildPgrDocxPreviewContent(): PgrDocxContent {
  const risk = Object.fromEntries(
    RISK_FIELDS.map((field) => [field, tag(field)]),
  ) as Pick<PgrDocxRisk, (typeof RISK_FIELDS)[number]>;
  return {
    emittedAt: tag("emittedAt"),
    validity: tag("validity"),
    validityYears: "{anosVigencia}",
    company: {
      razaoSocial: tag("company.razaoSocial"),
      nomeFantasia: tag("company.nomeFantasia"),
      cityState: tag("company.cityState"),
      address: tag("company.address"),
      cnpj: tag("company.cnpj"),
      stateRegistration: tag("company.stateRegistration"),
      phone: tag("company.phone"),
      cnae: tag("company.cnae"),
      riskGrade: tag("company.riskGrade"),
    },
    workUnit: {
      name: tag("workUnit.name"),
      contractNumbers: tag("workUnit.contractNumbers"),
      address: tag("workUnit.address"),
      addressCity: tag("workUnit.addressCity"),
    },
    contract: {
      contractor: tag("contract.contractor"),
      contractorCnpj: tag("contract.contractorCnpj"),
      number: tag("contract.number"),
      manager: tag("contract.manager"),
      inspector: tag("contract.inspector"),
      agent: tag("contract.agent"),
      agentContact: tag("contract.agentContact"),
      object: tag("contract.object"),
      term: tag("contract.term"),
      employees: tag("contract.employees"),
      executionPlace: tag("contract.executionPlace"),
    },
    responsibles: {
      author: tag("responsibles.author"),
      authorRegistration: tag("responsibles.authorRegistration"),
      coauthors: tag("responsibles.coauthors"),
      coauthorRegistration: tag("responsibles.coauthorRegistration"),
      companyResponsible: tag("responsibles.companyResponsible"),
      registrationType: tag("responsibles.registrationType"),
    },
    cipa: {
      riskGrade: "{grauRisco}",
      employeeCount: "{numeroEmpregados}",
      effectiveMembers: "{cipaTitulares}",
      alternateMembers: "{cipaSuplentes}",
      trainingHours: "{cipaHorasTreinamento}",
    },
    revisions: [
      {
        number: tag("number"),
        date: tag("date"),
        validUntil: tag("validUntil"),
        description: tag("description"),
        responsible: tag("responsible"),
      },
    ],
    jobRoles: [
      {
        name: tag("name"),
        description: tag("description"),
        workload: tag("workload"),
        employeeCount: tag("employeeCount"),
      },
    ],
    jobRolesTotal: tag("jobRolesTotal"),
    trainingMatrix: {
      columns: ["{{treinamento 1}}", "{{treinamento 2}}", "{{treinamento 3}}", "{{…}}"],
      rows: [
        { name: "{{função 1}}", marks: [true, false, true, false] },
        { name: "{{função 2}}", marks: [false, true, true, false] },
      ],
    },
    ges: [
      {
        title: tag("title"),
        processDescription: tag("processDescription"),
        construction: {
          buildingType: tag("construction.buildingType"),
          ceilingHeight: tag("construction.ceilingHeight"),
          floor: tag("construction.floor"),
          roof: tag("construction.roof"),
          lighting: tag("construction.lighting"),
          ventilation: tag("construction.ventilation"),
          other: tag("construction.other"),
        },
        jobRoles: [{ name: tag("name"), description: "" }],
        risks: [
          {
            ...risk,
            number: "{{number}}" as unknown as number,
            agentKey: "physical",
            riskClass: "moderate",
          },
        ],
        measures: [
          {
            riskLabel: tag("riskLabel"),
            riskName: tag("riskName"),
            elimination: level("elimination"),
            collective: level("collective"),
            administrative: level("administrative"),
            individual: level("individual"),
          },
        ],
        epis: [
          {
            riskRef: tag("riskRef"),
            hazard: tag("hazard"),
            epi: tag("epi"),
            ca: tag("ca"),
            neutralizes: tag("neutralizes"),
          },
        ],
        actions: [
          {
            riskRef: tag("riskRef"),
            occupationalRisk: tag("occupationalRisk"),
            riskLevel: tag("riskLevel"),
            action: tag("action"),
            tracking: tag("tracking"),
            measurement: tag("measurement"),
            responsible: tag("responsible"),
            deadline: tag("deadline"),
            status: tag("status"),
          },
        ],
      },
    ],
  };
}

/**
 * Ajusta os derivados da prévia (contagens do dashboard) para mostrarem o campo — só a
 * chave (`{{total}}`), porque o cartão é estreito; a tag real é `dashboard.<chave>`.
 */
export function previewDerivedTags(data: PgrDocxTemplateData): PgrDocxTemplateData {
  return {
    ...data,
    ges: data.ges.map((ges) => ({
      ...ges,
      dashboard: Object.fromEntries(
        Object.keys(ges.dashboard).map((key) => [key, tag(key)]),
      ) as typeof ges.dashboard,
    })),
  };
}
