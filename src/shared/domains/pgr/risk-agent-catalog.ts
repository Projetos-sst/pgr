import {
  measurementUnitLabel,
  measurementUnitSchema,
  riskAgentTypeLabel,
  riskAgentTypeSchema,
  type MeasurementUnit,
  type RiskAgentType,
} from "./risks";

export type CatalogAgent = {
  name: string;
  units: readonly MeasurementUnit[];
  source: string;
};

const QUALITATIVE: readonly MeasurementUnit[] = ["qualitative_na"];
const UNITS = measurementUnitSchema.options;
const OUTSIDE_SUFFIX = "(fora do usual do grupo)";

export const RISK_AGENT_CATALOG: Record<RiskAgentType, readonly CatalogAgent[]> = {
  physical: [
    {
      name: "Ruído contínuo ou intermitente",
      units: ["db_a"],
      source: "NR-15, Anexo 1",
    },
    { name: "Ruído de impacto", units: ["db_c"], source: "NR-15, Anexo 2" },
    { name: "Vibração de mãos e braços", units: ["m_s2"], source: "NR-15, Anexo 8" },
    { name: "Vibração de corpo inteiro", units: ["m_s2"], source: "NR-15, Anexo 8" },
    { name: "Calor", units: ["celsius"], source: "NR-15, Anexo 3" },
    { name: "Frio", units: QUALITATIVE, source: "NR-15, Anexo 9" },
    { name: "Umidade", units: QUALITATIVE, source: "NR-15, Anexo 10" },
    { name: "Radiações não ionizantes", units: QUALITATIVE, source: "NR-15, Anexo 7" },
  ],
  chemical: [
    { name: "Gases e vapores", units: ["ppm", "mg_m3"], source: "NR-15, Anexo 11" },
    {
      name: "Poeiras minerais com sílica livre",
      units: ["mg_m3", "percent"],
      source: "NR-15, Anexo 12",
    },
    { name: "Fibras de asbesto", units: ["f_cm3"], source: "NR-15, Anexo 12" },
    { name: "Fumos metálicos", units: ["mg_m3"], source: "NR-15, Anexos 11 e 12" },
  ],
  biological: [
    { name: "Vírus, bactérias e fungos", units: QUALITATIVE, source: "NR-15, Anexo 14" },
    { name: "Parasitas e protozoários", units: QUALITATIVE, source: "NR-15, Anexo 14" },
  ],
  ergonomic: [
    { name: "Postura inadequada", units: QUALITATIVE, source: "NR-17" },
    {
      name: "Levantamento e transporte manual de cargas",
      units: QUALITATIVE,
      source: "NR-17",
    },
    { name: "Movimentos repetitivos", units: QUALITATIVE, source: "NR-17" },
    { name: "Iluminação inadequada", units: ["lux"], source: "NR-17 e NHO 11" },
  ],
  mechanical: [
    {
      name: "Máquinas e equipamentos sem proteção",
      units: QUALITATIVE,
      source: "NR-12",
    },
    {
      name: "Ferramentas manuais ou motorizadas",
      units: QUALITATIVE,
      source: "NR-12",
    },
  ],
  accident: [
    { name: "Queda de diferente nível", units: QUALITATIVE, source: "NR-35" },
    { name: "Choque elétrico", units: QUALITATIVE, source: "NR-10" },
    { name: "Incêndio ou explosão", units: QUALITATIVE, source: "NR-23" },
  ],
  psychosocial: [
    { name: "Sobrecarga de trabalho", units: QUALITATIVE, source: "NR-01 e NR-17" },
    {
      name: "Assédio e violência no trabalho",
      units: QUALITATIVE,
      source: "NR-01 e NR-17",
    },
  ],
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

function categoryAgents(agentType: string): readonly CatalogAgent[] {
  const category = riskAgentTypeSchema.safeParse(agentType);
  return category.success ? RISK_AGENT_CATALOG[category.data] : [];
}

function matchingAgents(
  agentType: string,
  hazard: string | null | undefined,
): readonly CatalogAgent[] {
  const agents = categoryAgents(agentType);
  const name = normalize(hazard ?? "");
  const named = agents.filter((agent) => normalize(agent.name) === name);
  return named.length > 0 ? named : agents;
}

export function catalogAgentNames(agentType: string): string[] {
  return categoryAgents(agentType).map((agent) => agent.name);
}

export function usualUnits(agentType: string, hazard?: string | null): MeasurementUnit[] {
  const usual = new Set([
    ...QUALITATIVE,
    ...matchingAgents(agentType, hazard).flatMap((agent) => agent.units),
  ]);
  return UNITS.filter((unit) => usual.has(unit));
}

export type CatalogUnitCheck = {
  agentType: RiskAgentType;
  hazard: string | null;
  unit: MeasurementUnit | null;
};

export function isUsualUnit(check: CatalogUnitCheck): boolean {
  return (
    check.unit !== null && usualUnits(check.agentType, check.hazard).includes(check.unit)
  );
}

export function unitCatalogNotice(check: CatalogUnitCheck): string | null {
  if (check.unit === null || isUsualUnit(check)) return null;
  const usual = usualUnits(check.agentType, check.hazard)
    .map(measurementUnitLabel)
    .join(", ");
  return `A unidade ${measurementUnitLabel(check.unit)} não está entre as usuais do grupo ${riskAgentTypeLabel(check.agentType)} (${usual}). O registro continua válido; confira a unidade.`;
}

export function unitOptionsFor(agentType: string): { value: string; label: string }[] {
  const usual = categoryAgents(agentType).length > 0 ? usualUnits(agentType) : UNITS;
  const outside = UNITS.filter((unit) => !usual.includes(unit));
  return [
    ...usual.map((unit) => ({ value: unit, label: measurementUnitLabel(unit) })),
    ...outside.map((unit) => ({
      value: unit,
      label: `${measurementUnitLabel(unit)} ${OUTSIDE_SUFFIX}`,
    })),
  ];
}
