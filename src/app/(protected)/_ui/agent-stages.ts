/**
 * Lógica pura do feedback de progresso dos agentes de IA. Fica fora do componente
 * para ser coberta por teste unitário — o `AgentProgress` só desenha o resultado.
 *
 * A chamada ao provedor **não é streaming**: não existe progresso real para reportar.
 * O que o usuário vê é uma sequência **fixa** de etapas, definida por agente, avançando
 * por tempo — honesta no sentido de descrever o que o agente está de fato fazendo, sem
 * fingir uma medição que não temos. Por isso a barra nunca chega a 100% sozinha: ela
 * se aproxima assintoticamente do teto e só completa quando a resposta chega.
 */

/** Tempo (ms) que cada etapa permanece na tela antes de ceder lugar à próxima. */
export const STAGE_DWELL_MS = 2200;

/** Teto da barra enquanto a resposta não chega — o restante fica para a conclusão. */
export const PROGRESS_CEILING = 92;

/**
 * Constante de tempo (ms) da curva de progresso. Calibrada para a latência observada
 * dos agentes (~8–10s): em ~9s a barra está perto de 80%, ainda avançando.
 */
const PROGRESS_TAU_MS = 4500;

/**
 * Etapa visível em `elapsedMs`. Avança de `dwellMs` em `dwellMs` e **trava na última** —
 * uma resposta mais lenta que o roteiro nunca deixa o usuário sem legenda.
 */
export function agentStageIndex(
  elapsedMs: number,
  stageCount: number,
  dwellMs: number = STAGE_DWELL_MS,
): number {
  if (stageCount <= 0) return 0;
  const index = Math.floor(Math.max(0, elapsedMs) / dwellMs);
  return Math.min(index, stageCount - 1);
}

/**
 * Percentual da barra em `elapsedMs`: cresce rápido no início e desacelera, sem nunca
 * ultrapassar `PROGRESS_CEILING`. Evita tanto a barra que trava em 100% e mente quanto
 * a que anda linear e estoura o fim antes da resposta.
 */
export function agentProgressPercent(elapsedMs: number): number {
  const eased = 1 - Math.exp(-Math.max(0, elapsedMs) / PROGRESS_TAU_MS);
  return Math.round(PROGRESS_CEILING * eased);
}
