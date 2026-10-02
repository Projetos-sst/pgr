/**
 * Identidade visual do PGR em DOCX — a mesma do design system da plataforma
 * (`app/globals.css`: indigo `#5b63f5`, Manrope + JetBrains Mono, superfícies claras
 * e bordas suaves). Compartilhado pelo gerador do template (`scripts/pgr-docx`) e
 * pelos blocos montados em código (`rich-text.ts`, `training-matrix.ts`), para que
 * o que o código injeta no documento tenha o mesmo visual do que o template desenha.
 *
 * Cores em hex SEM `#` (formato do OOXML).
 */

export const PGR_DOCX_FONT = "Manrope";
export const PGR_DOCX_MONO_FONT = "JetBrains Mono";

export const PGR_DOCX_COLORS = {
  primary: "5B63F5",
  primaryStrong: "4F46E5",
  primarySoft: "EEF0FE",
  primarySofter: "F7F7FF",
  text: "1B1F2E",
  muted: "52576E",
  subtle: "8C91A8",
  border: "E3E5EE",
  borderStrong: "C9CCDA",
  surface: "FFFFFF",
  surfaceAlt: "F6F6F9",
  background: "EAE9E8",
  white: "FFFFFF",
} as const;

/** Tamanhos em meio-ponto (unidade do OOXML: 19 = 9,5pt). */
export const PGR_DOCX_SIZES = {
  body: 18,
  small: 16,
  table: 15,
  tableSmall: 13,
  label: 14,
  h1: 21,
  h2: 19,
} as const;

/**
 * Tipos de agente do inventário. A paleta segue o gráfico de categorias do dashboard
 * da plataforma (físico indigo, químico violeta, ergonômico azul-céu, biológico
 * teal, acidente âmbar), escurecida o bastante para texto branco no cabeçalho do
 * cartão de risco.
 */
export const PGR_DOCX_AGENT_KEYS = [
  "physical",
  "chemical",
  "biological",
  "ergonomic",
  "accident",
  "psychosocial",
  "other",
] as const;
export type PgrDocxAgentKey = (typeof PGR_DOCX_AGENT_KEYS)[number];

export const PGR_DOCX_AGENT_COLORS: Record<
  PgrDocxAgentKey,
  { fill: string; text: string }
> = {
  physical: { fill: "5B63F5", text: "FFFFFF" },
  chemical: { fill: "8B5CF6", text: "FFFFFF" },
  biological: { fill: "0D9488", text: "FFFFFF" },
  ergonomic: { fill: "0284C7", text: "FFFFFF" },
  accident: { fill: "F5A524", text: "1B1F2E" },
  psychosocial: { fill: "52576E", text: "FFFFFF" },
  other: { fill: "8C91A8", text: "FFFFFF" },
};

/** Classes de risco (mesma ordem/semântica de `RISK_CLASSIFICATION_ORDER`). */
export const PGR_DOCX_RISK_CLASSES = [
  "trivial",
  "tolerable",
  "moderate",
  "substantial",
  "intolerable",
] as const;
export type PgrDocxRiskClass = (typeof PGR_DOCX_RISK_CLASSES)[number];

/**
 * Cores por classe — as mesmas famílias do editor de metodologia da plataforma
 * (green/lime/yellow/orange/red do Tailwind). `soft` = fundo de card/KPI,
 * `strong` = célula da matriz, `text` = texto sobre ambos.
 */
export const PGR_DOCX_RISK_CLASS_COLORS: Record<
  PgrDocxRiskClass,
  { soft: string; strong: string; text: string; label: string; range: string }
> = {
  trivial: {
    soft: "DCFCE7",
    strong: "86EFAC",
    text: "14532D",
    label: "Trivial",
    range: "1-3",
  },
  tolerable: {
    soft: "ECFCCB",
    strong: "BEF264",
    text: "365314",
    label: "Tolerável",
    range: "3-8",
  },
  moderate: {
    soft: "FEF9C3",
    strong: "FDE047",
    text: "713F12",
    label: "Moderado",
    range: "4-12",
  },
  substantial: {
    soft: "FFEDD5",
    strong: "FDBA74",
    text: "7C2D12",
    label: "Substancial",
    range: "10-15",
  },
  intolerable: {
    soft: "FEE2E2",
    strong: "FCA5A5",
    text: "7F1D1D",
    label: "Intolerável",
    range: "15-25",
  },
};

/**
 * Matriz 5×5 (AIHA) exatamente como no PGR de referência: linhas = probabilidade
 * 5 → 1, colunas = severidade 1 → 5.
 */
export const PGR_DOCX_RISK_MATRIX: readonly (readonly PgrDocxRiskClass[])[] = [
  ["tolerable", "moderate", "substantial", "intolerable", "intolerable"],
  ["tolerable", "tolerable", "moderate", "substantial", "intolerable"],
  ["trivial", "tolerable", "moderate", "substantial", "intolerable"],
  ["trivial", "tolerable", "moderate", "moderate", "substantial"],
  ["trivial", "trivial", "tolerable", "moderate", "moderate"],
];
