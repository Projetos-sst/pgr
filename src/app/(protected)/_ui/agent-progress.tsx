"use client";

import { useEffect, useState } from "react";

import { STAGE_DWELL_MS, agentProgressPercent, agentStageIndex } from "./agent-stages";

/**
 * Feedback de execução de um agente de IA: barra linear + a etapa corrente do roteiro
 * **fixo** daquele agente ("Pensando…" → "Mapeando riscos…" → …). Substitui o antigo
 * "Consultando IA…" no botão, que não dizia nada durante os ~5–20s de espera. Monte o
 * componente ao disparar o agente e desmonte na resposta.
 *
 * Acessibilidade: um único `role="status"` com `aria-live="polite"` anuncia a troca de
 * etapa; a barra expõe `role="progressbar"` com o valor corrente. Quem pediu menos
 * movimento no SO (WCAG 2.3.3) recebe a mesma informação sem a animação.
 */
export function AgentProgress({
  stages,
  className = "",
}: {
  /** Roteiro fixo do agente, na ordem. A última etapa permanece até a resposta chegar. */
  stages: readonly string[];
  className?: string;
}) {
  const elapsed = useElapsedMs();
  const stage = stages[agentStageIndex(elapsed, stages.length)] ?? stages[0];
  const percent = agentProgressPercent(elapsed);

  return (
    <div role="status" aria-live="polite" className={`flex flex-col gap-2 ${className}`}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Progresso do agente de IA"
        className="h-1 w-full overflow-hidden rounded-full bg-black/[0.07]"
      >
        <div
          className="bg-primary agent-progress-bar h-full rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-text-muted flex items-center gap-2 text-sm">
        <span
          aria-hidden="true"
          className="bg-primary agent-progress-dot inline-block size-1.5 shrink-0 rounded-full"
        />
        {stage}
      </p>
    </div>
  );
}

/**
 * Milissegundos desde a montagem. Quem controla o ciclo é o chamador, que monta este
 * componente ao disparar o agente e o desmonta na resposta — assim cada execução começa
 * naturalmente do zero, sem precisar reagir a mudança de prop. O tick é bem menor que o
 * `dwell` da etapa para a barra andar suave sem custar re-render caro.
 */
function useElapsedMs(): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - startedAt), STAGE_DWELL_MS / 12);
    return () => clearInterval(id);
  }, []);

  return elapsed;
}
