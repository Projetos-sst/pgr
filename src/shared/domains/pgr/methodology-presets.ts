import type { ControlLevel } from "./risks";
import { controlLevelLabel } from "./risks";
import type {
  ClassificationBand,
  MethodologyBase,
  MethodologyGrade,
  RiskMethodologyValues,
} from "./methodology";

/**
 * Valores padrão por base de metodologia (issue #76). Ao escolher uma base na UI,
 * o formulário **preenche** (editável) as gradações e faixas com o preset.
 *
 * ⚠️ Os rótulos das gradações seguem a sugestão do card (comuns às bases). As
 * **fronteiras das faixas** por base são padrões razoáveis e **editáveis** — não
 * há tabela oficial única no card; ajuste conforme a fonte adotada pela org.
 */

const PROBABILITY_GRADES: MethodologyGrade[] = [
  { level: 1, label: "Rara", description: "Improvável durante a vida do trabalhador." },
  { level: 2, label: "Pouco Provável", description: "Pode ocorrer, mas é raro." },
  { level: 3, label: "Possível", description: "Pode ocorrer ocasionalmente." },
  { level: 4, label: "Provável", description: "Ocorre com frequência." },
  { level: 5, label: "Muito Provável", description: "Esperado; ocorre rotineiramente." },
];

const SEVERITY_GRADES: MethodologyGrade[] = [
  { level: 1, label: "Leve", description: "Sem necessidade de atenção médica." },
  { level: 2, label: "Séria", description: "Lesão reversível com atenção médica." },
  {
    level: 3,
    label: "Crítica",
    description: "Lesão irreversível / incapacidade parcial.",
  },
  { level: 4, label: "Incapacitante", description: "Incapacidade permanente ou morte." },
  {
    level: 5,
    label: "Catastrófica",
    description: "Mortes ou incapacidades múltiplas (> 10).",
  },
];

function bands(t1: number, t2: number, t3: number, t4: number): ClassificationBand[] {
  return [
    { classification: "trivial", maxLevel: t1 },
    { classification: "tolerable", maxLevel: t2 },
    { classification: "moderate", maxLevel: t3 },
    { classification: "substantial", maxLevel: t4 },
    { classification: "intolerable", maxLevel: 25 },
  ];
}

/**
 * Presets por base. Gradações comuns; fronteiras de faixa distintas para refletir
 * o rigor relativo de cada metodologia (defaults editáveis).
 */
export const METHODOLOGY_PRESETS: Record<
  MethodologyBase,
  Omit<RiskMethodologyValues, "base">
> = {
  fundacentro: {
    probabilityGrades: PROBABILITY_GRADES,
    severityGrades: SEVERITY_GRADES,
    classificationBands: bands(2, 6, 12, 20),
  },
  aiha: {
    probabilityGrades: PROBABILITY_GRADES,
    severityGrades: SEVERITY_GRADES,
    classificationBands: bands(3, 8, 12, 16),
  },
  as_nzs_4360: {
    probabilityGrades: PROBABILITY_GRADES,
    severityGrades: SEVERITY_GRADES,
    classificationBands: bands(2, 5, 10, 15),
  },
  custom: {
    probabilityGrades: PROBABILITY_GRADES,
    severityGrades: SEVERITY_GRADES,
    classificationBands: bands(2, 6, 12, 20),
  },
};

/** Base usada como padrão quando a organização ainda não configurou a metodologia. */
export const DEFAULT_METHODOLOGY_BASE: MethodologyBase = "fundacentro";

/** Preset completo (com `base`) de uma base. */
export function presetFor(base: MethodologyBase): RiskMethodologyValues {
  return { base, ...METHODOLOGY_PRESETS[base] };
}

/** Metodologia padrão (fallback) para orgs sem configuração — não é persistida. */
export function defaultRiskMethodology(): RiskMethodologyValues {
  return presetFor(DEFAULT_METHODOLOGY_BASE);
}

/**
 * Hierarquia de controle da NR-01 (4 níveis) — seção **read-only** da tela. Reusa
 * `controlLevelLabel` do domínio de riscos para o rótulo; a descrição é constante.
 */
export const NR01_CONTROL_HIERARCHY: {
  level: ControlLevel;
  label: string;
  description: string;
}[] = [
  {
    level: "elimination",
    label: controlLevelLabel("elimination"),
    description: "Eliminar o risco ou o fator de risco (medida mais eficaz).",
  },
  {
    level: "collective_protection",
    label: controlLevelLabel("collective_protection"),
    description: "Medidas de proteção coletiva que reduzem a exposição de todos.",
  },
  {
    level: "administrative",
    label: controlLevelLabel("administrative"),
    description: "Medidas administrativas ou de organização do trabalho.",
  },
  {
    level: "ppe",
    label: controlLevelLabel("ppe"),
    description: "Uso de EPI — último nível, quando os anteriores não bastam.",
  },
];
