import type { ClassificationBand } from "../methodology";

import type { PgrDocxAgentKey, PgrDocxRiskClass } from "./theme";

/**
 * Conteúdo de EXIBIÇÃO do PGR em DOCX — tudo já formatado como texto, na ordem e
 * no vocabulário do documento. É a fronteira entre "de onde vêm os dados" e "como o
 * template os desenha":
 *
 * - produção: `buildPgrDocxContent(consolidado, extras)` lê o banco e monta isto;
 * - réplica/exemplos: um JSON neste formato (fixture) entra direto.
 *
 * Campo vazio (`""`) = não informado. O template esconde linhas opcionais vazias
 * (contrato, CIPA, coautor) por condição; o resto imprime vazio.
 */
export type PgrDocxContent = {
  /** Data/hora de emissão impressa no rodapé ("10/09/2026 11:19"). */
  emittedAt: string;
  emissionNotice?: string;
  machines?: {
    name: string;
    manufacturer: string;
    identifier: string;
    quantity: string;
    description: string;
    operatingConditions: string;
    safetyMeasures: string;
    maintenanceNotes: string;
    responsible: string;
    context: string;
  }[];
  /** Vigência da capa ("08/2026 a 05/2028"). */
  validity: string;
  /** Anos da vigência no título do Anexo I ("2026–2028"). Ausente = derivado de `validity`. */
  validityYears?: string;
  company: {
    razaoSocial: string;
    nomeFantasia: string;
    /** Linha "CIDADE - UF" da capa. */
    cityState: string;
    /** Endereço numa linha ("AV EXEMPLO, 1000 | CAMPINAS - SP"). */
    address: string;
    cnpj: string;
    stateRegistration: string;
    phone: string;
    /** CNAE com descrição ("42.99-5-99 (Outras obras ...)"). */
    cnae: string;
    riskGrade: string;
  };
  workUnit: {
    name: string;
    contractNumbers: string;
    address: string;
    addressCity: string;
  };
  /** Dados do contrato com a contratante — todos opcionais (obra sem contrato = vazio). */
  contract: {
    contractor: string;
    contractorCnpj: string;
    number: string;
    manager: string;
    inspector: string;
    agent: string;
    agentContact: string;
    object: string;
    term: string;
    employees: string;
    executionPlace: string;
  };
  responsibles: {
    author: string;
    authorRegistration: string;
    coauthors: string;
    coauthorRegistration: string;
    companyResponsible: string;
    registrationType: string;
  };
  /** Valores que entram no texto semi-fixo da CIPA (seção 12). Opcional. */
  cipa?: {
    riskGrade?: string;
    employeeCount?: string;
    effectiveMembers?: string;
    alternateMembers?: string;
    /** Carga horária do treinamento. Ausente = mínimo da NR-05 para o grau de risco. */
    trainingHours?: string;
  };
  revisions: PgrDocxRevision[];
  jobRoles: PgrDocxJobRole[];
  jobRolesTotal: string;
  trainingMatrix: PgrDocxTrainingMatrix;
  ges: PgrDocxGes[];
  classificationBands?: ClassificationBand[];
};

export type PgrDocxRevision = {
  number: string;
  date: string;
  validUntil: string;
  description: string;
  /** Pode ter quebras de linha (`\n`) — um responsável por linha. */
  responsible: string;
};

export type PgrDocxJobRole = {
  name: string;
  description: string;
  workload: string;
  employeeCount: string;
};

export type PgrDocxTrainingMatrix = {
  /** Treinamentos (colunas), ex.: "NR 06", "NR 35", "RAC 01". */
  columns: string[];
  rows: { name: string; marks: boolean[] }[];
};

export type PgrDocxGes = {
  /** Título do bloco ("GES 1 - GES 01 - ADMINISTRATIVO DO CANTEIRO"). */
  title: string;
  processDescription: string;
  construction: {
    buildingType: string;
    ceilingHeight: string;
    floor: string;
    roof: string;
    lighting: string;
    ventilation: string;
    other: string;
  };
  jobRoles: { name: string; description: string }[];
  risks: PgrDocxRisk[];
  measures: PgrDocxRiskMeasures[];
  epis: PgrDocxEpi[];
  actions: PgrDocxAction[];
};

export type PgrDocxRisk = {
  number: number;
  /** Rótulo do tipo de agente ("Físico", "Mecânicos/Acidentes"). */
  agentType: string;
  agentKey: PgrDocxAgentKey;
  /** Nível com faixa ("Tolerável (3-8)"). */
  riskLevel: string;
  riskClass: PgrDocxRiskClass | null;
  hazard: string;
  risk: string;
  sources: string;
  propagation: string;
  exposureTime: string;
  injuries: string;
  criterion: string;
  esocialCode: string;
  /** "UNIDADE DE MEDIDA (eSOCIAL):" ou "GRUPO DE RISCO ERGONÔMICO:". */
  unitLabel: string;
  unitValue: string;
  uncertainty: string;
  probability: string;
  severity: string;
  controlNeed: string;
  result: string;
  toleranceLimit: string;
};

export type PgrDocxMeasureLevel = {
  applies: string;
  measures: string;
  monitoring: string;
};

/** Hierarquia de controle da NR-01 (1.4.1 g) para um risco — sempre os 4 níveis. */
export type PgrDocxRiskMeasures = {
  riskLabel: string;
  riskName: string;
  elimination: PgrDocxMeasureLevel;
  collective: PgrDocxMeasureLevel;
  administrative: PgrDocxMeasureLevel;
  individual: PgrDocxMeasureLevel;
};

export type PgrDocxEpi = {
  riskRef: string;
  hazard: string;
  epi: string;
  ca: string;
  neutralizes: string;
};

export type PgrDocxAction = {
  riskRef: string;
  occupationalRisk: string;
  riskLevel: string;
  action: string;
  tracking: string;
  measurement: string;
  responsible: string;
  deadline: string;
  status: string;
};
