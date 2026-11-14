import type {
  PgrDocxAction,
  PgrDocxContent,
  PgrDocxEpi,
  PgrDocxGes,
  PgrDocxMeasureLevel,
  PgrDocxRisk,
  PgrDocxRiskMeasures,
} from "./content";
import { PGR_DOCX_EXAMPLE_CONTENT } from "./example-content";
import {
  PGR_DOCX_AGENT_KEYS,
  PGR_DOCX_RISK_CLASS_COLORS,
  PGR_DOCX_RISK_CLASSES,
  type PgrDocxAgentKey,
} from "./theme";

export const PGR_DOCX_SAMPLE_CASE_IDS = [
  "empresa-pequena",
  "inventario-extenso",
  "campos-vazios",
  "com-anexos",
] as const;

export type PgrDocxSampleCaseId = (typeof PGR_DOCX_SAMPLE_CASE_IDS)[number];

export type PgrDocxSampleCase = {
  id: PgrDocxSampleCaseId;
  title: string;
  checks: string;
  content: PgrDocxContent;
};

export const SAMPLE_NOTICE =
  "AMOSTRA FICTÍCIA PARA HOMOLOGAÇÃO DO MODELO — não representa cliente, parecer ou assinatura.";

export const LARGE_GES_COUNT = 6;
export const LARGE_RISKS_PER_GES = 8;
export const LARGE_JOB_ROLE_COUNT = 36;

const AGENT_LABELS: Record<PgrDocxAgentKey, string> = {
  physical: "Físico",
  chemical: "Químico",
  biological: "Biológico",
  ergonomic: "Ergonômico",
  accident: "Mecânicos/Acidentes",
  psychosocial: "Psicossocial",
  other: "Outros",
};

const base = PGR_DOCX_EXAMPLE_CONTENT;
const pad = (value: number) => String(value).padStart(2, "0");

const level = (applies: string, index: number): PgrDocxMeasureLevel => ({
  applies,
  measures: `Medida fictícia ${index} descrita para testar a largura da coluna.`,
  monitoring: `Verificação fictícia ${index}`,
});

function largeRisk(ges: number, number: number): PgrDocxRisk {
  const position = (ges - 1) * LARGE_RISKS_PER_GES + number - 1;
  const agentKey = PGR_DOCX_AGENT_KEYS[position % PGR_DOCX_AGENT_KEYS.length];
  const riskClass = PGR_DOCX_RISK_CLASSES[position % PGR_DOCX_RISK_CLASSES.length];
  const band = PGR_DOCX_RISK_CLASS_COLORS[riskClass];
  return {
    number,
    agentType: AGENT_LABELS[agentKey],
    agentKey,
    riskLevel: `${band.label} (${band.range})`,
    riskClass,
    hazard: `Perigo fictício ${pad(ges)}.${pad(number)}`,
    risk: `Risco fictício ${pad(ges)}.${pad(number)} com descrição longa o bastante para ocupar mais de uma linha da célula`,
    sources: `Fonte geradora fictícia ${pad(number)} do ambiente ${pad(ges)}`,
    propagation: "Ar",
    exposureTime: "4 a 7 h/turno de 8h ou 20 a 35 h/sem",
    injuries: "Agravo fictício descrito apenas para compor a amostra",
    criterion: number % 2 === 0 ? "Quantitativo" : "Qualitativo",
    esocialCode: "Não informado",
    unitLabel: "UNIDADE DE MEDIDA (eSOCIAL):",
    unitValue: "Não informado",
    uncertainty: "1 - Incerta",
    probability: "3 - Exposição moderada",
    severity: "2 - Lesão ou doenças sérias reversíveis",
    controlNeed: "Informação adicional necessária",
    result: number % 2 === 0 ? `${70 + number} dB(A)` : "",
    toleranceLimit: number % 2 === 0 ? "85 dB(A)" : "",
  };
}

function largeMeasures(risk: PgrDocxRisk): PgrDocxRiskMeasures {
  return {
    riskLabel: `RISCO ${risk.number}`,
    riskName: risk.risk,
    elimination: level("Não", 1),
    substitution: level("Não", 2),
    collective: level("Sim", 3),
    administrative: level("Sim", 4),
    individual: level("Sim", 5),
  };
}

function largeEpi(risk: PgrDocxRisk): PgrDocxEpi {
  return {
    riskRef: `RISCO ${risk.number}`,
    hazard: risk.hazard,
    epi: `Equipamento fictício ${pad(risk.number)}`,
    ca: `000${pad(risk.number)}`,
    neutralizes: risk.number % 3 === 0 ? "Não" : "Sim",
  };
}

function largeAction(risk: PgrDocxRisk): PgrDocxAction {
  return {
    riskRef: `RISCO ${risk.number}`,
    occupationalRisk: risk.risk,
    riskLevel: risk.riskLevel,
    action: `Ação fictícia ${pad(risk.number)} planejada para o risco.`,
    tracking: "Acompanhamento mensal fictício.",
    measurement: "Indicador fictício de conclusão.",
    responsible: "SESMT",
    deadline: `${pad(risk.number)}-03-2027`,
    status: "Programado",
  };
}

function largeGes(index: number): PgrDocxGes {
  const risks = Array.from({ length: LARGE_RISKS_PER_GES }, (_, at) =>
    largeRisk(index, at + 1),
  );
  return {
    title: `GES ${pad(index)} - AMBIENTE FICTÍCIO ${pad(index)}`,
    processDescription: `Processo fictício do ambiente ${pad(index)}, descrito apenas para testar o inventário com muitas linhas.`,
    construction: base.ges[0].construction,
    jobRoles: [
      { name: `FUNÇÃO FICTÍCIA ${pad(index)}`, description: "" },
      { name: `FUNÇÃO FICTÍCIA ${pad(index + LARGE_GES_COUNT)}`, description: "" },
    ],
    risks,
    measures: risks.map(largeMeasures),
    epis: risks.map(largeEpi),
    actions: risks.map(largeAction),
  };
}

const largeJobRoles = Array.from({ length: LARGE_JOB_ROLE_COUNT }, (_, at) => ({
  name: `FUNÇÃO FICTÍCIA ${pad(at + 1)}`,
  description: `Atividade fictícia ${pad(at + 1)}: executar tarefas de exemplo, registrar ocorrências e seguir os procedimentos do ambiente.`,
  workload: "07h00min – 17h00min (Segunda a Sexta-feira); Intervalo: 01h00min",
  employeeCount: String((at % 5) + 1),
}));

const emptyRisk: PgrDocxRisk = {
  number: 1,
  agentType: "Outros",
  agentKey: "other",
  riskLevel: "Não avaliado",
  riskClass: null,
  hazard: "Perigo fictício sem avaliação",
  risk: "Risco fictício sem avaliação",
  sources: "",
  propagation: "",
  exposureTime: "",
  injuries: "",
  criterion: "",
  esocialCode: "",
  unitLabel: "",
  unitValue: "",
  uncertainty: "",
  probability: "",
  severity: "",
  controlNeed: "",
  result: "",
  toleranceLimit: "",
};

const emptyConstruction = {
  buildingType: "",
  ceilingHeight: "",
  floor: "",
  roof: "",
  lighting: "",
  ventilation: "",
  other: "",
};

const blankContract = {
  contractor: "",
  contractorCnpj: "",
  number: "",
  manager: "",
  inspector: "",
  agent: "",
  agentContact: "",
  object: "",
  term: "",
  employees: "",
  executionPlace: "",
};

export const PGR_DOCX_SAMPLE_CASES: readonly PgrDocxSampleCase[] = [
  {
    id: "empresa-pequena",
    title: "Empresa pequena com um GES",
    checks: "Documento mínimo completo: capa, identificação, um GES e um risco.",
    content: {
      ...base,
      emissionNotice: SAMPLE_NOTICE,
      company: {
        ...base.company,
        razaoSocial: "OFICINA MODELO FICTÍCIA LTDA",
        nomeFantasia: "OFICINA MODELO",
        riskGrade: "2",
      },
      workUnit: { ...base.workUnit, name: "SEDE", contractNumbers: "" },
      contract: blankContract,
      cipa: { riskGrade: "2", employeeCount: "2" },
      jobRoles: base.jobRoles.slice(0, 2),
      jobRolesTotal: "2",
      trainingMatrix: {
        columns: base.trainingMatrix.columns.slice(0, 2),
        rows: base.trainingMatrix.rows
          .slice(0, 2)
          .map((row) => ({ ...row, marks: row.marks.slice(0, 2) })),
      },
      ges: base.ges.slice(0, 1),
    },
  },
  {
    id: "inventario-extenso",
    title: "Inventário extenso com quebra de página",
    checks:
      "Tabelas que atravessam páginas: quadro de funções, medidas, EPIs, plano de ação e Anexo I.",
    content: {
      ...base,
      emissionNotice: SAMPLE_NOTICE,
      company: { ...base.company, razaoSocial: "INDÚSTRIA EXTENSA FICTÍCIA S.A." },
      cipa: { riskGrade: "3", employeeCount: "108" },
      jobRoles: largeJobRoles,
      jobRolesTotal: String(
        largeJobRoles.reduce((sum, role) => sum + Number(role.employeeCount), 0),
      ),
      trainingMatrix: {
        columns: ["NR 06", "NR 10", "NR 12", "NR 18", "NR 33", "NR 35"],
        rows: largeJobRoles.map((role, at) => ({
          name: role.name,
          marks: [true, at % 2 === 0, at % 3 === 0, true, at % 4 === 0, at % 5 === 0],
        })),
      },
      ges: Array.from({ length: LARGE_GES_COUNT }, (_, at) => largeGes(at + 1)),
    },
  },
  {
    id: "campos-vazios",
    title: "Campos opcionais vazios",
    checks:
      "Opcionais somem ou mostram 'Não informado'; listas vazias mostram a mensagem própria.",
    content: {
      emittedAt: base.emittedAt,
      emissionNotice: SAMPLE_NOTICE,
      validity: "",
      company: {
        razaoSocial: "EMPRESA SEM OPCIONAIS FICTÍCIA LTDA",
        nomeFantasia: "",
        cityState: "",
        address: "",
        cnpj: "00.000.000/0001-00",
        stateRegistration: "",
        phone: "",
        cnae: "",
        riskGrade: "",
      },
      workUnit: { name: "", contractNumbers: "", address: "", addressCity: "" },
      contract: blankContract,
      responsibles: {
        author: "",
        authorRegistration: "",
        coauthors: "",
        coauthorRegistration: "",
        companyResponsible: "",
        registrationType: "",
      },
      revisions: [],
      jobRoles: [],
      jobRolesTotal: "0",
      trainingMatrix: { columns: [], rows: [] },
      ges: [
        {
          title: "GES 01 - AMBIENTE SEM RISCO CADASTRADO",
          processDescription: "",
          construction: emptyConstruction,
          jobRoles: [],
          risks: [],
          measures: [],
          epis: [],
          actions: [],
        },
        {
          title: "GES 02 - RISCO SEM AVALIAÇÃO",
          processDescription: "",
          construction: emptyConstruction,
          jobRoles: [],
          risks: [emptyRisk],
          measures: [],
          epis: [],
          actions: [],
        },
      ],
    },
  },
  {
    id: "com-anexos",
    title: "Documento com anexos",
    checks:
      "Anexo I, matriz de treinamento, cronograma de campanhas e apêndice de máquinas.",
    content: {
      ...base,
      emissionNotice: SAMPLE_NOTICE,
      machines: [
        {
          name: "Betoneira fictícia 400 L",
          manufacturer: "Fabricante fictício",
          identifier: "AMOSTRA-001",
          quantity: "2",
          description: "Equipamento de exemplo vinculado ao ambiente fictício.",
          operatingConditions: "Operação diurna, em área sinalizada.",
          safetyMeasures: "Proteção de partes móveis e botão de parada de emergência.",
          maintenanceNotes: "Inspeção mensal fictícia registrada em checklist.",
          responsible: "Pessoa fictícia",
          context: "GES 02 - ESTRUTURA E ALVENARIA",
        },
        {
          name: "Serra circular de bancada fictícia",
          manufacturer: "Fabricante fictício",
          identifier: "AMOSTRA-002",
          quantity: "1",
          description: "Equipamento de exemplo para corte de madeira.",
          operatingConditions: "Uso por operador treinado.",
          safetyMeasures: "Coifa protetora, cutelo divisor e empurrador.",
          maintenanceNotes: "Troca de disco conforme desgaste.",
          responsible: "Pessoa fictícia",
          context: "GES 02 - ESTRUTURA E ALVENARIA",
        },
      ],
    },
  },
];
