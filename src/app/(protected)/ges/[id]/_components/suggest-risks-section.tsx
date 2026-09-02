"use client";

import { useState, useTransition } from "react";

import { AgentProgress } from "@/app/(protected)/_ui/agent-progress";
import { Skeleton } from "@/app/(protected)/_ui/skeleton";
import {
  suggestRisks,
  acceptSuggestedRisks,
} from "@/shared/server/actions/pgr/ai-risk-suggestion";
import type { SuggestedRisk } from "@/shared/domains/pgr/ai-risk-suggestion";
import { riskAgentTypeLabel } from "@/shared/domains/pgr/risks";

/**
 * US1 — Botão "Sugerir Riscos com IA" + modal de revisão com seleção. A IA nunca
 * adiciona nada automaticamente: o usuário revisa, seleciona e confirma; os riscos
 * aceitos entram como rascunho no inventário do GES para complementação.
 *
 * O modal abre **imediatamente** no clique, já em estado de carregamento (roteiro do
 * agente + esqueleto das linhas): a chamada leva ~8–10s e um botão desabilitado nesse
 * tempo não diz ao usuário que algo está acontecendo.
 */

/** Roteiro fixo exibido enquanto o agente de riscos roda (ver `agent-stages.ts`). */
const RISK_AGENT_STAGES = [
  "Pensando…",
  "Lendo o contexto do GES…",
  "Mapeando riscos…",
  "Classificando os agentes de risco…",
  "Organizando as sugestões…",
] as const;
export function SuggestRisksSection({ gesId }: { gesId: string }) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedRisk[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    setNotice(null);
    setSuggestions([]);
    setSelected(new Set());
    setOpen(true);
    startGenerate(async () => {
      const result = await suggestRisks(gesId);
      if (!result.ok) {
        setOpen(false);
        setError(result.error.message);
        return;
      }
      setSuggestions(result.data.suggestions);
      setSelected(new Set(result.data.suggestions.map((_, i) => i)));
    });
  }

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function accept() {
    const chosen = suggestions.filter((_, i) => selected.has(i));
    if (chosen.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await acceptSuggestedRisks(gesId, { suggestions: chosen });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setOpen(false);
      setNotice(
        `${result.data.created} risco(s) adicionado(s) como rascunho. Complete os campos obrigatórios em cada risco.`,
      );
    });
  }

  return (
    <section className="glass-card flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-text text-lg font-semibold">
            Sugestão de riscos com a IA pgr-e
          </h2>
          <p className="text-text-subtle text-sm">
            Gera riscos candidatos a partir do processo, ambiente e funções deste GES.
            Você revisa e escolhe o que adicionar.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={generating || pending}
          className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {generating ? "Consultando a IA pgr-e…" : "Sugerir riscos com a IA pgr-e"}
        </button>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

      {open ? (
        <ReviewModal
          suggestions={suggestions}
          selected={selected}
          generating={generating}
          pending={pending}
          onToggle={toggle}
          onAccept={accept}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </section>
  );
}

function ReviewModal({
  suggestions,
  selected,
  generating,
  pending,
  onToggle,
  onAccept,
  onClose,
}: {
  suggestions: SuggestedRisk[];
  selected: Set<number>;
  generating: boolean;
  pending: boolean;
  onToggle: (index: number) => void;
  onAccept: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Revisão de riscos sugeridos pela IA pgr-e"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="glass-card flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-hidden bg-white/90 p-5">
        <header className="flex items-center justify-between">
          <h3 className="text-text text-lg font-semibold">
            {generating
              ? "Sugerindo riscos…"
              : `Riscos sugeridos (${suggestions.length})`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
          >
            Fechar
          </button>
        </header>

        {generating ? (
          <>
            <AgentProgress stages={RISK_AGENT_STAGES} />
            <ul aria-hidden="true" className="flex flex-col gap-2 overflow-hidden">
              {[0, 1, 2].map((row) => (
                <li key={row} className="glass-panel rounded-card flex gap-3 p-3">
                  <Skeleton className="mt-1 size-4 rounded" />
                  <div className="flex w-full flex-col gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : suggestions.length === 0 ? (
          <p className="text-text-subtle text-sm">
            A IA pgr-e não sugeriu riscos — descreva melhor o processo e o ambiente do GES
            e tente novamente.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 overflow-y-auto">
            {suggestions.map((s, index) => (
              <li key={index} className="glass-panel rounded-card flex gap-3 p-3">
                <input
                  type="checkbox"
                  checked={selected.has(index)}
                  onChange={() => onToggle(index)}
                  className="mt-1"
                  aria-label={`Selecionar risco: ${s.description}`}
                />
                <div className="flex flex-col gap-1">
                  <span className="text-text-muted inline-flex w-fit rounded bg-white/60 px-2 py-0.5 text-xs font-medium">
                    {riskAgentTypeLabel(s.agentType)}
                  </span>
                  <span className="text-text font-medium">{s.description}</span>
                  {s.hazard ? (
                    <span className="text-text-muted text-sm">Perigo: {s.hazard}</span>
                  ) : null}
                  {s.sources ? (
                    <span className="text-text-muted text-sm">
                      Fontes geradoras: {s.sources}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <footer className="flex items-center justify-between border-t border-white/50 pt-3">
          <span className="text-text-subtle text-sm">
            {generating ? "Aguardando o agente…" : `${selected.size} selecionado(s)`}
          </span>
          <button
            type="button"
            onClick={onAccept}
            disabled={generating || pending || selected.size === 0}
            className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Adicionando…" : "Adicionar selecionados"}
          </button>
        </footer>
      </div>
    </div>
  );
}
