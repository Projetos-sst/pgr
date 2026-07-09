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
    <section className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Sugestão de riscos por IA</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Gera riscos candidatos a partir do processo, ambiente e funções deste GES.
            Você revisa e escolhe o que adicionar.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending && !open ? "Consultando IA…" : "Sugerir Riscos com IA"}
        </button>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {notice ? (
        <p className="text-sm text-green-700 dark:text-green-400">{notice}</p>
      ) : null}

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-lg bg-white p-5 shadow-xl dark:bg-zinc-900">
        <header className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Riscos sugeridos ({suggestions.length})
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15"
          >
            Fechar
          </button>
        </header>

        {suggestions.length === 0 ? (
          <p className="text-sm text-zinc-500">
            A IA não sugeriu riscos — descreva melhor o processo e o ambiente do GES e
            tente novamente.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 overflow-y-auto">
            {suggestions.map((s, index) => (
              <li
                key={index}
                className="flex gap-3 rounded-md border border-black/5 p-3 dark:border-white/5"
              >
                <input
                  type="checkbox"
                  checked={selected.has(index)}
                  onChange={() => onToggle(index)}
                  className="mt-1"
                  aria-label={`Selecionar risco: ${s.description}`}
                />
                <div className="flex flex-col gap-1">
                  <span className="inline-flex w-fit rounded bg-black/5 px-2 py-0.5 text-xs font-medium dark:bg-white/10">
                    {riskAgentTypeLabel(s.agentType)}
                  </span>
                  <span className="font-medium">{s.description}</span>
                  {s.hazard ? (
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      Perigo: {s.hazard}
                    </span>
                  ) : null}
                  {s.sources ? (
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      Fontes geradoras: {s.sources}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <footer className="flex items-center justify-between border-t border-black/5 pt-3 dark:border-white/5">
          <span className="text-sm text-zinc-500">{selected.size} selecionado(s)</span>
          <button
            type="button"
            onClick={onAccept}
            disabled={pending || selected.size === 0}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {pending ? "Adicionando…" : "Adicionar selecionados"}
          </button>
        </footer>
      </div>
    </div>
  );
}
