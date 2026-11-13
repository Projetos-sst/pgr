export const PGR_DOCX_COVERAGE_AREAS = [
  "identification",
  "inventory",
  "assessments",
  "controls",
  "actionPlan",
  "annexes",
] as const;

export type PgrDocxCoverageArea = (typeof PGR_DOCX_COVERAGE_AREAS)[number];

export type PgrDocxCoverageBlock = {
  area: PgrDocxCoverageArea;
  block: string;
  tags: readonly string[];
};

export const PGR_DOCX_COVERAGE: readonly PgrDocxCoverageBlock[] = [
  {
    area: "identification",
    block: "Capa",
    tags: ["labels.documentTitle", "@cover.razaoSocialXml", "@cover.validityXml"],
  },
  {
    area: "identification",
    block: "Empregador",
    tags: ["company.razaoSocial", "company.cnpj", "company.cnae", "company.riskGrade"],
  },
  {
    area: "identification",
    block: "Unidade, obra e contrato",
    tags: ["workUnit.name", "@workUnitAddressXml", "#contract.hasAny"],
  },
  {
    area: "identification",
    block: "Responsáveis",
    tags: ["responsibles.author", "responsibles.companyResponsible"],
  },
  {
    area: "identification",
    block: "Histórico de revisões",
    tags: ["#revisions"],
  },
  {
    area: "identification",
    block: "Sumário e seções de texto",
    tags: ["#summary", "titles.introduction", "titles.finalProvisions"],
  },
  {
    area: "inventory",
    block: "Quadro de funções",
    tags: ["#jobRoles", "jobRolesTotal"],
  },
  {
    area: "inventory",
    block: "Caracterização do GES",
    tags: ["#ges", "processDescription", "construction.buildingType"],
  },
  {
    area: "inventory",
    block: "Perigos e riscos por GES",
    tags: ["#risks", "agentType", "hazard", "risk", "sources", "injuries"],
  },
  {
    area: "inventory",
    block: "Painel de riscos por GES",
    tags: ["dashboard.total"],
  },
  {
    area: "assessments",
    block: "Avaliação qualitativa e quantitativa do risco",
    tags: [
      "riskLevel",
      "probability",
      "severity",
      "uncertainty",
      "criterion",
      "result",
      "toleranceLimit",
      "exposureTime",
    ],
  },
  {
    area: "assessments",
    block: "Metodologia e matriz de risco",
    tags: [
      "#methodology.probabilityQuantitative.rows",
      "#methodology.probabilityQualitative.rows",
      "#methodology.severity.rows",
      "@riskMatrixXml",
    ],
  },
  {
    area: "controls",
    block: "Medidas de prevenção por hierarquia",
    tags: [
      "#measures",
      "elimination.measures",
      "collective.measures",
      "administrative.measures",
      "individual.measures",
    ],
  },
  {
    area: "controls",
    block: "Equipamentos de proteção individual",
    tags: ["#epis", "epi", "ca", "neutralizes"],
  },
  {
    area: "controls",
    block: "Necessidade de controle",
    tags: ["controlNeed", "labels.controlNeedTable"],
  },
  {
    area: "actionPlan",
    block: "Plano de ação por GES",
    tags: ["#actions", "action", "deadline", "status"],
  },
  {
    area: "actionPlan",
    block: "Cronograma consolidado de ações",
    tags: ["#annexActions"],
  },
  {
    area: "annexes",
    block: "Anexo I: cronograma de implementação",
    tags: ["titles.annexSchedule", "#annexActions"],
  },
  {
    area: "annexes",
    block: "Matriz de treinamento por função",
    tags: ["titles.trainingMatrix", "@trainingMatrixXml"],
  },
  {
    area: "annexes",
    block: "Cronograma de campanhas de saúde",
    tags: ["titles.healthSchedule", "@campaignsXml"],
  },
  {
    area: "annexes",
    block: "Apêndice de máquinas e equipamentos",
    tags: ["#hasMachines", "#machines"],
  },
];

export function missingCoverage(templateTags: readonly string[]): PgrDocxCoverageBlock[] {
  const present = new Set(templateTags);
  return PGR_DOCX_COVERAGE.map((block) => ({
    ...block,
    tags: block.tags.filter((tag) => !present.has(tag)),
  })).filter((block) => block.tags.length > 0);
}
