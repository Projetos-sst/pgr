"use client";

import { useState, useTransition } from "react";

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
 */
export function SuggestRisksSection({ gesId }: { gesId: string }) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedRisk[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await suggestRisks(gesId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSuggestions(result.data.suggestions);
      setSelected(new Set(result.data.suggestions.map((_, i) => i)));
      setOpen(true);
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
    <section className="glass-card flex flex-col gap-4 rounded-[20px] p-6 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 pb-4">
        <div>
          <h2 className="text-text text-lg font-bold">Sugestão de riscos por IA</h2>
          <p className="text-text-subtle text-xs">
            Gera riscos candidatos a partir do processo, ambiente e funções deste GES.
            Você revisa e escolhe o que adicionar.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="btn-primary hover-lift rounded-card shadow-primary flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50 sm:text-sm"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          {pending && !open ? "Consultando IA…" : "Sugerir Riscos com IA"}
        </button>
      </header>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      {notice ? <p className="text-sm font-semibold text-emerald-700">{notice}</p> : null}

      {open ? (
        <ReviewModal
          suggestions={suggestions}
          selected={selected}
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
  pending,
  onToggle,
  onAccept,
  onClose,
}: {
  suggestions: SuggestedRisk[];
  selected: Set<number>;
  pending: boolean;
  onToggle: (index: number) => void;
  onAccept: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Revisão de riscos sugeridos pela IA"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
    >
      <div className="glass-card flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-[20px] p-6 shadow-2xl">
        <header className="flex items-center justify-between border-b border-black/5 pb-3">
          <h3 className="text-text text-lg font-bold">
            Riscos sugeridos ({suggestions.length})
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="glass-panel text-text-subtle hover:text-text rounded-card px-3.5 py-1.5 text-xs font-semibold transition-colors"
          >
            Fechar
          </button>
        </header>

        {suggestions.length === 0 ? (
          <p className="text-text-subtle text-sm">
            A IA não sugeriu riscos — descreva melhor o processo e o ambiente do GES e
            tente novamente.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5 overflow-y-auto pr-1">
            {suggestions.map((s, index) => (
              <li key={index} className="glass-panel rounded-card flex gap-3.5 p-4">
                <input
                  type="checkbox"
                  checked={selected.has(index)}
                  onChange={() => onToggle(index)}
                  className="text-primary focus:ring-primary mt-1 h-4 w-4 rounded border-gray-300"
                  aria-label={`Selecionar risco: ${s.description}`}
                />
                <div className="flex flex-col gap-1">
                  <span className="bg-primary/10 text-primary inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-bold">
                    {riskAgentTypeLabel(s.agentType)}
                  </span>
                  <span className="text-text font-semibold">{s.description}</span>
                  {s.hazard ? (
                    <span className="text-text-subtle text-xs">Perigo: {s.hazard}</span>
                  ) : null}
                  {s.sources ? (
                    <span className="text-text-subtle text-xs">
                      Fontes geradoras: {s.sources}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <footer className="flex items-center justify-between border-t border-black/5 pt-4">
          <span className="text-text-subtle text-xs font-semibold">
            {selected.size} selecionado(s)
          </span>
          <button
            type="button"
            onClick={onAccept}
            disabled={pending || selected.size === 0}
            className="btn-primary hover-lift rounded-card shadow-primary px-5 py-2 text-xs font-bold text-white transition-all disabled:opacity-50 sm:text-sm"
          >
            {pending ? "Adicionando…" : "Adicionar selecionados"}
          </button>
        </footer>
      </div>
    </div>
  );
}
