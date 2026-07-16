/**
 * Derivação pura de riscos psicossociais a partir das estatísticas agregadas das
 * respostas. Perguntas Likert (1–5) cujo escore médio supera o threshold viram um
 * fator de risco psicossocial, com nível 1–4 proporcional ao escore.
 *
 * Convenção: escala Likert onde **maior escore = maior exposição/risco**.
 */

// Threshold padrão (média a partir da qual o fator é considerado risco).
export const DEFAULT_PSYCHOSOCIAL_THRESHOLD = 3;

export type QuestionStat = {
  questionId: string;
  text: string;
  questionType: string;
  average: number | null; // média do valueInt (só Likert); null se sem respostas numéricas
  responseCount: number;
};

export type DerivedRisk = {
  factor: string;
  level: number; // 1–4 (NR-01)
  description: string;
  sourceQuestionId: string;
};

// Classifica o nível NR-01 (1–4) a partir da média Likert.
export function classifyLevel(average: number): number {
  if (average >= 4.5) return 4;
  if (average >= 3.75) return 3;
  if (average >= 3) return 2;
  return 1;
}

export function deriveRisks(
  stats: QuestionStat[],
  threshold: number = DEFAULT_PSYCHOSOCIAL_THRESHOLD,
): DerivedRisk[] {
  const risks: DerivedRisk[] = [];
  for (const s of stats) {
    if (s.questionType !== "likert") continue;
    if (s.average == null || s.responseCount === 0) continue;
    if (s.average < threshold) continue;
    const level = classifyLevel(s.average);
    risks.push({
      factor: s.text,
      level,
      description: `Escore médio ${s.average.toFixed(2)} em ${s.responseCount} resposta(s) — acima do limiar ${threshold}.`,
      sourceQuestionId: s.questionId,
    });
  }
  return risks;
}
