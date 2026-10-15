import { formatCnpj } from "../companies";
import {
  assessmentCriterionLabel,
  epiNeutralizationLabel,
  exposureTimeLabel,
  formatMeasurement,
  measureStateLabel,
  measurementUnitLabel,
  nr09ConclusionLabel,
  ergonomicAdequacyText,
  formatCampaignPeriod,
  type ConsolidatedAddress,
  type ConsolidatedMeasure,
  type ConsolidatedRisk,
  type ControlLevel,
  type PgrConsolidated,
  type RiskAgentType,
} from "../pgr-consolidated";
import { pgrRegistrationTypeLabel, uncertaintyDegreeLabel } from "../risks";
import { isNr09EligibleAgent } from "../nr09";

import type {
  PgrDocxAction,
  PgrDocxContent,
  PgrDocxEpi,
  PgrDocxGes,
  PgrDocxJobRole,
  PgrDocxMeasureLevel,
  PgrDocxRisk,
  PgrDocxRiskMeasures,
  PgrDocxTrainingMatrix,
} from "./content";
import { DEFAULT_METHODOLOGY, type PgrDocxMethodology } from "./defaults";
import { PGR_DOCX_RISK_CLASS_COLORS, type PgrDocxAgentKey } from "./theme";

/**
 * Banco → conteúdo do template. Junta a visão consolidada do PGR (`getPgrConsolidated`,
 * a mesma do PDF HTML) com os extras do DOCX (`getPgrDocxExtras`) e formata tudo no
 * vocabulário do documento de referência ("2 - Controle em conformidade legal",
 * "Tolerável (3-8)", datas `dd-mm-aaaa`). Função pura: testável sem banco.
 *
 * Regra: só dado persistido entra; o que o modelo ainda não tem (inscrição estadual,
 * dados do contrato com a contratante, composição da CIPA) sai vazio ou "Não informado"
 * — nunca inventado.
 */

export type PgrDocxGesExtras = {
  processDescription: string | null;
  constructionType: string | null;
  ceilingHeight: string | null;
  floor: string | null;
  roof: string | null;
  lighting: string | null;
  ventilation: string | null;
  otherCharacteristics: string | null;
  jobRoles: {
    id: string;
    title: string;
    description: string | null;
    workSchedule: string | null;
    workerCount: number;
  }[];
};

export type PgrDocxExtras = {
  company: { phone: string | null; logoPath: string | null };
  revisions: { revisionNumber: number; revisedAt: string; notes: string | null }[];
  /** Por id de GES. */
  ges: Record<string, PgrDocxGesExtras>;
  /** Treinamentos obrigatórios por função (`job_role_required_trainings`). */
  requiredTrainings: { jobRoleId: string; trainingId: string; label: string }[];
};

export type PgrDocxContentOptions = {
  /** Data/hora de emissão já formatada ("02/10/2026 09:30"). */
  emittedAt: string;
  /** Metodologia usada para os textos de probabilidade/severidade/controle. */
  methodology?: PgrDocxMethodology;
};

const NOT_INFORMED = "Não informado";
const NOT_ASSESSED = "Não avaliado";

const text = (value: string | null | undefined) => value?.trim() ?? "";
const orNotInformed = (value: string | null | undefined) => text(value) || NOT_INFORMED;

/** "2026-10-01" → "01-10-2026" (`sep` troca o separador). Vazio/inválido → "". */
export function formatDocxDate(iso: string | null | undefined, sep = "-"): string {
  const match = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? [match[3], match[2], match[1]].join(sep) : "";
}

/** "2026-10-01" + "2028-09-30" → "10/2026 a 09/2028". */
export function formatValidity(
  issuedAt: string | null | undefined,
  validUntil: string | null | undefined,
): string {
  const monthYear = (iso: string | null | undefined) => formatDocxDate(iso, "/").slice(3);
  return [monthYear(issuedAt), monthYear(validUntil)].filter(Boolean).join(" a ");
}

const cityState = (address: ConsolidatedAddress) =>
  [text(address.city), text(address.state)].filter(Boolean).join(" - ");

const streetLine = (address: ConsolidatedAddress) =>
  [
    [text(address.street), text(address.number)].filter(Boolean).join(", "),
    text(address.complement),
    text(address.district),
  ]
    .filter(Boolean)
    .join(" - ");

/** Vocabulário do documento de referência (o PGR junta mecânico e acidente). */
const AGENT: Record<RiskAgentType, { key: PgrDocxAgentKey; label: string }> = {
  physical: { key: "physical", label: "Físico" },
  chemical: { key: "chemical", label: "Químico" },
  biological: { key: "biological", label: "Biológico" },
  ergonomic: { key: "ergonomic", label: "Ergonômico" },
  mechanical: { key: "accident", label: "Mecânicos/Acidentes" },
  accident: { key: "accident", label: "Mecânicos/Acidentes" },
  psychosocial: { key: "psychosocial", label: "Psicossocial" },
};

const ERGONOMIC_AGENTS = new Set<RiskAgentType>(["ergonomic", "psychosocial"]);

const LEVELS: {
  level: ControlLevel;
  key: keyof Omit<PgrDocxRiskMeasures, "riskLabel" | "riskName">;
}[] = [
  { level: "elimination", key: "elimination" },
  { level: "collective_protection", key: "collective" },
  { level: "administrative", key: "administrative" },
  { level: "ppe", key: "individual" },
];

/** "Tolerável (3-8)" — `null` (sem avaliação) → "Não avaliado". */
export function riskLevelText(risk: Pick<ConsolidatedRisk, "result">): string {
  if (!risk.result) return NOT_ASSESSED;
  const { label, range } = PGR_DOCX_RISK_CLASS_COLORS[risk.result];
  return `${label} (${range})`;
}

const withoutFinalPeriod = (value: string) => value.replace(/\.\s*$/, "");

/** Preserva dados da exportação anterior que não cabem nas células do cartão. */
function assessmentDetails(risk: ConsolidatedRisk): string {
  const lines: string[] = [];
  const field = (label: string, value: string | null | undefined) =>
    lines.push(`${label}: ${orNotInformed(value)}`);
  const assessment = risk.assessment;
  if (isNr09EligibleAgent(risk.agentType)) {
    lines.push("Avaliação quantitativa (NR-09)");
    field("Data", formatDocxDate(assessment?.assessedAt));
    field("Método", assessment?.evaluationMethod);
    if (assessment?.measuredValue == null) lines.push("Sem medição registrada");
    field(
      "Conclusão registrada",
      assessment?.nr09Conclusion ? nr09ConclusionLabel(assessment.nr09Conclusion) : null,
    );
  }

  lines.push("Avaliação ergonômica (NR-17)");
  const ergonomic = risk.ergonomic;
  if (!ergonomic) {
    lines.push("Sem avaliação ergonômica registrada");
  } else {
    field("Data", formatDocxDate(ergonomic.assessedAt));
    field("Responsável", ergonomic.responsible);
    field("Método", ergonomic.method);
    for (const dimension of ergonomic.dimensions) {
      lines.push(`${dimension.label}: ${ergonomicAdequacyText(dimension.adequacy)}`);
      if (text(dimension.notes)) field("Observações", dimension.notes);
    }
    field("Observações gerais", ergonomic.notes);
    const aggregate = ergonomic.psychosocial;
    if (aggregate) {
      lines.push("Resultado agregado da campanha psicossocial");
      field("Campanha", aggregate.name);
      field("Período", formatCampaignPeriod(aggregate.startsAt, aggregate.endsAt));
      lines.push(`Respostas: ${aggregate.responseCount}`);
      for (const factor of aggregate.factors) {
        lines.push(`${factor.factor}: nível registrado ${factor.level}`);
      }
    }
  }

  for (const measure of risk.measures.filter((item) => item.applicable)) {
    if (!text(measure.actionWhat)) continue;
    lines.push(`Plano 5W2H — ${measure.actionWhat}`);
    field("Por quê", measure.actionWhy);
    field("Como", measure.actionHow);
    field("Quanto", measure.actionCost);
  }
  for (const epi of risk.epis) {
    lines.push(`Detalhes do EPI — ${epi.name}`);
    field("Descrição", epi.description);
    field("Validade do CA", formatDocxDate(epi.caValidUntil));
    field("Fabricante", epi.manufacturer);
    field("Norma", epi.norm);
    field("Material", epi.material);
    field("Tamanho", epi.size);
    field("Unidade de medida", epi.unitOfMeasure);
    field("Vida útil (meses)", epi.usefulLifeMonths?.toString());
  }
  return lines.join("\n");
}

function mapRisk(
  risk: ConsolidatedRisk,
  number: number,
  methodology: PgrDocxMethodology,
): PgrDocxRisk {
  const agent = AGENT[risk.agentType];
  const assessment = risk.assessment;
  const unitLabel = ERGONOMIC_AGENTS.has(risk.agentType)
    ? "GRUPO DE RISCO ERGONÔMICO:"
    : "UNIDADE DE MEDIDA (eSOCIAL):";

  let probability = NOT_ASSESSED;
  let severity = NOT_ASSESSED;
  let uncertainty = NOT_ASSESSED;
  let controlNeed = NOT_ASSESSED;
  if (assessment) {
    const probabilityRows =
      assessment.criterion === "quantitative"
        ? methodology.probabilityQuantitative.rows.map((row) => row.category)
        : methodology.probabilityQualitative.rows.map((row) => row.control);
    const probabilityText = probabilityRows[assessment.probability - 1];
    probability = probabilityText
      ? `${assessment.probability} - ${probabilityText}`
      : String(assessment.probability);
    const severityText = methodology.severity.rows[assessment.severity - 1]?.definition;
    severity = severityText
      ? `${assessment.severity} - ${withoutFinalPeriod(severityText)}`
      : String(assessment.severity);
    uncertainty = `${assessment.uncertaintyDegree} - ${uncertaintyDegreeLabel(assessment.uncertaintyDegree)}`;
    if (assessment.result) {
      const need = methodology.controlNeed[assessment.result];
      controlNeed =
        assessment.uncertaintyDegree >= 2
          ? need.highlyUncertain
          : assessment.uncertaintyDegree === 1
            ? need.uncertain
            : need.certain;
    }
  }

  return {
    assessmentDetails: assessmentDetails(risk),
    number,
    agentType: agent.label,
    agentKey: agent.key,
    riskLevel: riskLevelText(risk),
    riskClass: risk.result,
    hazard: orNotInformed(risk.hazard),
    risk: risk.description,
    sources: orNotInformed(risk.sources),
    propagation: orNotInformed(risk.propagation),
    exposureTime: risk.exposureTime ? exposureTimeLabel(risk.exposureTime) : NOT_INFORMED,
    injuries: orNotInformed(risk.possibleInjuries),
    criterion: assessment ? assessmentCriterionLabel(assessment.criterion) : NOT_ASSESSED,
    esocialCode: orNotInformed(risk.noxiousAgentCode),
    unitLabel,
    unitValue: risk.measurementUnit
      ? measurementUnitLabel(risk.measurementUnit)
      : NOT_INFORMED,
    uncertainty,
    probability,
    severity,
    controlNeed,
    result:
      formatMeasurement(assessment?.measuredValue, assessment?.measuredUnit) ??
      formatMeasurement(risk.concentrationIntensity, risk.measurementUnit) ??
      "",
    toleranceLimit:
      formatMeasurement(assessment?.toleranceLimitValue, assessment?.measuredUnit) ??
      text(assessment?.toleranceLimit),
  };
}

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

function measureLevel(measures: ConsolidatedMeasure[]): PgrDocxMeasureLevel {
  if (measures.length === 0) {
    return { applies: "—", measures: NOT_INFORMED, monitoring: "" };
  }
  const applicable = measures.filter((measure) => measure.applicable);
  const described = (applicable.length > 0 ? applicable : measures).map(
    (measure) => text(measure.actionWhat) || text(measure.justification),
  );
  return {
    applies: applicable.length > 0 ? "Sim" : "Não",
    measures: unique(described).join("; ") || NOT_INFORMED,
    monitoring: unique(measures.map((measure) => text(measure.monitoring))).join("; "),
  };
}

function mapMeasures(risk: ConsolidatedRisk, number: number): PgrDocxRiskMeasures {
  const byLevel = Object.fromEntries(
    LEVELS.map(({ level, key }) => [
      key,
      measureLevel(risk.measures.filter((measure) => measure.controlLevel === level)),
    ]),
  ) as Pick<PgrDocxRiskMeasures, (typeof LEVELS)[number]["key"]>;
  return { riskLabel: `RISCO ${number}`, riskName: risk.description, ...byLevel };
}

function mapEpis(risk: ConsolidatedRisk, number: number): PgrDocxEpi[] {
  return risk.epis.map((epi) => ({
    riskRef: `Risco ${number}`,
    hazard: text(risk.hazard) || risk.description,
    epi: epi.name,
    ca: text(epi.ca) || "—",
    neutralizes: epiNeutralizationLabel(epi.neutralization),
  }));
}

function mapActions(risk: ConsolidatedRisk, number: number): PgrDocxAction[] {
  return risk.measures
    .filter((measure) => measure.applicable && text(measure.actionWhat))
    .map((measure) => ({
      riskRef: `Risco ${number}`,
      occupationalRisk: risk.description,
      riskLevel: riskLevelText(risk),
      action: text(measure.actionWhat),
      tracking: text(measure.actionTracking),
      measurement: text(measure.actionMeasurement),
      responsible: text(measure.actionResponsible),
      deadline: formatDocxDate(measure.actionDeadline),
      status: measureStateLabel(measure.state),
    }));
}

function mapGes(
  ges: PgrConsolidated["ges"][number],
  index: number,
  extras: PgrDocxGesExtras | undefined,
  methodology: PgrDocxMethodology,
): PgrDocxGes {
  const numbered = ges.risks.map((risk, i) => ({ risk, number: i + 1 }));
  return {
    title: `GES ${index + 1} - ${ges.name}`,
    processDescription: text(extras?.processDescription),
    construction: {
      buildingType: orNotInformed(extras?.constructionType),
      ceilingHeight: orNotInformed(extras?.ceilingHeight?.replace(".", ",")),
      floor: orNotInformed(extras?.floor),
      roof: orNotInformed(extras?.roof),
      lighting: orNotInformed(extras?.lighting),
      ventilation: orNotInformed(extras?.ventilation),
      other: text(extras?.otherCharacteristics),
    },
    jobRoles: (extras?.jobRoles ?? []).map((role) => ({
      name: role.title,
      description: text(role.description),
    })),
    risks: numbered.map(({ risk, number }) => mapRisk(risk, number, methodology)),
    measures: numbered.map(({ risk, number }) => mapMeasures(risk, number)),
    epis: numbered.flatMap(({ risk, number }) => mapEpis(risk, number)),
    actions: numbered.flatMap(({ risk, number }) => mapActions(risk, number)),
  };
}

/** Quadro de funções (seção 4): a mesma função em vários GES soma os trabalhadores. */
function aggregateJobRoles(extras: PgrDocxExtras, gesIds: string[]) {
  const roles = new Map<string, PgrDocxJobRole & { id: string; count: number }>();
  for (const gesId of gesIds) {
    for (const role of extras.ges[gesId]?.jobRoles ?? []) {
      const current = roles.get(role.id);
      if (current) {
        current.count += role.workerCount;
        if (!current.workload) current.workload = text(role.workSchedule);
        continue;
      }
      roles.set(role.id, {
        id: role.id,
        name: role.title,
        description: text(role.description),
        workload: text(role.workSchedule),
        employeeCount: "",
        count: role.workerCount,
      });
    }
  }
  return [...roles.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((role) => ({ ...role, employeeCount: String(role.count) }));
}

function buildTrainingMatrix(
  extras: PgrDocxExtras,
  roles: { id: string; name: string }[],
): PgrDocxTrainingMatrix {
  const roleIds = new Set(roles.map((role) => role.id));
  const required = extras.requiredTrainings.filter((row) => roleIds.has(row.jobRoleId));
  const columns = [...new Map(required.map((row) => [row.trainingId, row.label]))];
  const marks = new Set(required.map((row) => `${row.jobRoleId}:${row.trainingId}`));
  return {
    columns: columns.map(([, label]) => label),
    rows:
      columns.length === 0
        ? []
        : roles.map((role) => ({
            name: role.name,
            marks: columns.map(([trainingId]) => marks.has(`${role.id}:${trainingId}`)),
          })),
  };
}

export function buildPgrDocxContent(
  data: PgrConsolidated,
  extras: PgrDocxExtras,
  options: PgrDocxContentOptions,
): PgrDocxContent {
  const methodology = options.methodology ?? DEFAULT_METHODOLOGY;
  const { pgr } = data;
  const company = pgr.company;
  const workUnit = pgr.workUnit;
  const emptyAddress: ConsolidatedAddress = {
    zipCode: null,
    street: null,
    number: null,
    complement: null,
    district: null,
    city: null,
    state: null,
  };
  const companyAddress = company?.address ?? emptyAddress;
  const unitAddress = workUnit?.address ?? emptyAddress;

  const jobRoles = aggregateJobRoles(
    extras,
    data.ges.map((ges) => ges.id),
  );
  const total = jobRoles.reduce((sum, role) => sum + role.count, 0);
  const totalText = total > 0 ? String(total) : "";

  const responsible = text(pgr.responsible);
  const revisions = extras.revisions.map((revision) => ({
    number: String(revision.revisionNumber).padStart(2, "0"),
    date: formatDocxDate(revision.revisedAt),
    // O histórico guarda número/data/notas, sem validade nem responsável daquela revisão.
    validUntil: "",
    description: text(revision.notes),
    responsible: "",
  }));

  // Bloco do contrato só com obra contratada: sem número de contrato ele some inteiro
  // (`contract.hasAny`). Contratante, gestor, fiscal e objeto ainda não têm coluna.
  const contractNumber = text(workUnit?.contractNumber);
  const unitAddressLine = streetLine(unitAddress);
  const ifContract = (value: string) => (contractNumber ? value : "");
  const term = [
    formatDocxDate(workUnit?.startDate, "/"),
    formatDocxDate(workUnit?.expectedEndDate, "/"),
  ]
    .filter(Boolean)
    .join(" a ");

  const cnae = [text(company?.cnae), text(company?.mainActivity)]
    .filter(Boolean)
    .join(" ")
    .replace(/^(\S+) (.+)$/, "$1 ($2)");

  return {
    emittedAt: options.emittedAt,
    validity: formatValidity(pgr.issuedAt, pgr.validUntil),
    company: {
      razaoSocial: company?.razaoSocial ?? pgr.companyName,
      nomeFantasia: text(company?.nomeFantasia),
      cityState: cityState(companyAddress).toUpperCase(),
      address: [streetLine(companyAddress), cityState(companyAddress)]
        .filter(Boolean)
        .join(" | "),
      cnpj: company?.cnpj ? formatCnpj(company.cnpj) : "",
      stateRegistration: "",
      phone: text(extras.company.phone),
      cnae,
      riskGrade: company?.riskGrade != null ? String(company.riskGrade) : "",
    },
    workUnit: {
      name: text(workUnit?.name ?? pgr.workUnitName),
      contractNumbers: contractNumber,
      address: unitAddressLine,
      addressCity: cityState(unitAddress),
    },
    contract: {
      contractor: "",
      contractorCnpj: "",
      number: contractNumber,
      manager: "",
      inspector: "",
      agent: ifContract(text(workUnit?.managerName)),
      agentContact: "",
      object: "",
      term: ifContract(term),
      employees: ifContract(totalText),
      executionPlace: ifContract(
        [unitAddressLine, cityState(unitAddress)].filter(Boolean).join(", "),
      ),
    },
    responsibles: {
      author: responsible,
      authorRegistration: text(pgr.registrationNumber),
      coauthors: "",
      coauthorRegistration: "",
      companyResponsible: text(workUnit?.managerName),
      registrationType: pgrRegistrationTypeLabel(pgr.registrationType),
    },
    cipa: {
      riskGrade: company?.riskGrade != null ? String(company.riskGrade) : undefined,
      employeeCount: totalText || undefined,
    },
    revisions,
    jobRoles: jobRoles.map(({ name, description, workload, employeeCount }) => ({
      name,
      description,
      workload,
      employeeCount,
    })),
    jobRolesTotal: totalText,
    trainingMatrix: buildTrainingMatrix(extras, jobRoles),
    ges: data.ges.map((ges, index) =>
      mapGes(ges, index, extras.ges[ges.id], methodology),
    ),
  };
}
