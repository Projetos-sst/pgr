"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AgentProgress } from "@/app/(protected)/_ui/agent-progress";
import { Skeleton } from "@/app/(protected)/_ui/skeleton";
import type { MatchedTrainingSuggestion } from "@/shared/domains/pgr/ai-training-suggestion";
import { trainingPeriodicityLabel } from "@/shared/domains/pgr/trainings";
import {
  acceptSuggestedTrainings,
  suggestRequiredTrainings,
} from "@/shared/server/actions/pgr/ai-required-trainings";

/**
 * Sugestão dos treinamentos obrigatórios da função pela IA pgr-e. O agente propõe a
 * partir do cargo, do GES e dos riscos da exposição; o catálogo da organização entra
 * como **vocabulário** — cada sugestão volta já reconciliada:
 *
 * - `alreadyRequired` → só informação, a linha nem pode ser marcada;
 * - `trainingId` preenchido → vincula o curso existente;
 * - `trainingId` nulo → o aceite cria o curso no catálogo e então vincula.
 */

/** Roteiro fixo exibido enquanto o agente de treinamentos roda (ver `agent-stages.ts`). */
const TRAINING_AGENT_STAGES = [
  "Pensando…",
  "Lendo a função e o GES…",
  "Cruzando com os riscos da exposição…",
  "Selecionando as NRs aplicáveis…",
  "Conferindo com o catálogo…",
] as const;

export function SuggestTrainingsSection({ jobRoleId }: { jobRoleId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<MatchedTrainingSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();
  const [pending, startAccept] = useTransition();

  function generate() {
    setError(null);
    setNotice(null);
    setSuggestions([]);
    setSelected(new Set());
    setOpen(true);
    startGenerate(async () => {
      const result = await suggestRequiredTrainings(jobRoleId);
      if (!result.ok) {
        setOpen(false);
        setError(result.error.message);
        return;
      }
      setSuggestions(result.data.suggestions);
      // Já obrigatório não é proposta: nasce desmarcado para não sugerir retrabalho.
      setSelected(
        new Set(
          result.data.suggestions.flatMap((s, i) => (s.alreadyRequired ? [] : [i])),
        ),
      );
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
    startAccept(async () => {
      const result = await acceptSuggestedTrainings(jobRoleId, { suggestions: chosen });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setOpen(false);
      const { linked, createdInCatalog } = result.data;
      setNotice(
        createdInCatalog > 0
          ? `${linked} treinamento(s) vinculado(s) — ${createdInCatalog} criado(s) no catálogo. Revise carga horária e periodicidade.`
          : `${linked} treinamento(s) vinculado(s) à função.`,
      );
      router.refresh();
    });
  }

  return (
    <section className="glass-card flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-text text-lg font-semibold">
            Sugestão de obrigatórios com a IA pgr-e
          </h2>
          <p className="text-text-subtle text-sm">
            Propõe os treinamentos exigidos para esta função a partir do cargo, do GES e
            dos riscos da exposição. Você revisa e escolhe o que vincular.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={generating || pending}
          className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {generating ? "Consultando a IA pgr-e…" : "Sugerir treinamentos com a IA pgr-e"}
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
  suggestions: MatchedTrainingSuggestion[];
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
      aria-label="Revisão de treinamentos sugeridos pela IA pgr-e"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="glass-card flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-hidden bg-white/90 p-5">
        <header className="flex items-center justify-between">
          <h3 className="text-text text-lg font-semibold">
            {generating
              ? "Sugerindo treinamentos…"
              : `Treinamentos sugeridos (${suggestions.length})`}
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
            <AgentProgress stages={TRAINING_AGENT_STAGES} />
            <ul aria-hidden="true" className="flex flex-col gap-2 overflow-hidden">
              {[0, 1, 2].map((row) => (
                <li key={row} className="glass-panel rounded-card flex gap-3 p-3">
                  <Skeleton className="mt-1 size-4 rounded" />
                  <div className="flex w-full flex-col gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : suggestions.length === 0 ? (
          <p className="text-text-subtle text-sm">
            A IA pgr-e não sugeriu treinamentos — descreva melhor a função e o GES
            (processo, ambiente e riscos) e tente novamente.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 overflow-y-auto">
            {suggestions.map((s, index) => (
              <li key={index} className="glass-panel rounded-card flex gap-3 p-3">
                <input
                  type="checkbox"
                  checked={selected.has(index)}
                  disabled={s.alreadyRequired}
                  onChange={() => onToggle(index)}
                  className="mt-1"
                  aria-label={`Selecionar treinamento: ${s.name}`}
                />
                <div className="flex flex-col gap-1">
                  <span className="text-text font-medium">{s.name}</span>
                  <span className="text-text-muted text-sm">
                    {trainingPeriodicityLabel(s.periodicity)} · {s.workloadHours}h
                    {s.referenceNorm ? ` · ${s.referenceNorm}` : ""}
                  </span>
                  {s.rationale ? (
                    <span className="text-text-subtle text-sm">{s.rationale}</span>
                  ) : null}
                  <span className="text-text-subtle text-xs">
                    {s.alreadyRequired
                      ? "Já é obrigatório nesta função"
                      : s.trainingId
                        ? "Já existe no catálogo — será apenas vinculado"
                        : "Novo no catálogo — será criado ao aceitar"}
                  </span>
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
            {pending ? "Vinculando…" : "Vincular selecionados"}
          </button>
        </footer>
      </div>
    </div>
  );
}
