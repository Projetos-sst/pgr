"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AgentProgress } from "@/app/(protected)/_ui/agent-progress";
import { Skeleton } from "@/app/(protected)/_ui/skeleton";
import type { AcceptedControlMeasure } from "@/shared/domains/pgr/ai-control-measure-suggestion";
import { controlLevelLabel } from "@/shared/domains/pgr/control-measure";
import {
  acceptSuggestedControlMeasures,
  suggestControlMeasures,
} from "@/shared/server/actions/pgr/ai-control-measures";

/**
 * Sugestão de medidas de controle pela IA pgr-e, no mesmo padrão da sugestão de riscos:
 * o modal abre já carregando, a IA só **propõe** e o usuário revisa e confirma. As
 * medidas aceitas entram pelo fluxo normal (`createControlMeasure`), que aplica a regra
 * de status pela classificação vigente e espelha no Plano de Ação.
 *
 * A UNIQUE por nível permite **uma** medida por nível NR-01, então o servidor já
 * descarta os níveis que o risco tem — o que chega aqui é sempre aceitável.
 *
 * Responsável e prazo são editáveis aqui, e **obrigatórios** quando o risco é moderado ou
 * superior (regra da issue #42). O modelo não os preenche de propósito — são compromisso
 * de pessoa. Sem cobrá-los na tela, o aceite morreria num `VALIDATION` do servidor e o
 * usuário perderia o lote inteiro de sugestões.
 */

/** Roteiro fixo exibido enquanto o agente de medidas roda (ver `agent-stages.ts`). */
const MEASURE_AGENT_STAGES = [
  "Pensando…",
  "Lendo o risco e a classificação…",
  "Percorrendo a hierarquia da NR-01…",
  "Redigindo as ações…",
  "Organizando as sugestões…",
] as const;

export function SuggestMeasuresSection({ riskId }: { riskId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AcceptedControlMeasure[]>([]);
  const [requiresPlan, setRequiresPlan] = useState(false);
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
      const result = await suggestControlMeasures(riskId);
      if (!result.ok) {
        setOpen(false);
        setError(result.error.message);
        return;
      }
      setSuggestions(result.data.suggestions);
      setRequiresPlan(result.data.requiresResponsibleAndDeadline);
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

  function edit(index: number, patch: Partial<AcceptedControlMeasure>) {
    setSuggestions((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function accept() {
    const chosen = suggestions.filter((_, i) => selected.has(i));
    if (chosen.length === 0) return;
    // Espelha a regra do servidor (#42) para o usuário corrigir sem perder as sugestões.
    if (
      requiresPlan &&
      chosen.some((s) => !s.actionResponsible?.trim() || !s.actionDeadline)
    ) {
      setError(
        "Este risco é moderado ou superior: informe responsável e prazo em cada medida selecionada.",
      );
      return;
    }
    setError(null);
    startAccept(async () => {
      const result = await acceptSuggestedControlMeasures(riskId, {
        suggestions: chosen,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setOpen(false);
      setNotice(
        `${result.data.created} medida(s) adicionada(s). Revise responsável e prazo em cada uma.`,
      );
      router.refresh();
    });
  }

  return (
    <section className="glass-card flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-text text-lg font-semibold">
            Sugestão de medidas com a IA pgr-e
          </h2>
          <p className="text-text-subtle text-sm">
            Propõe medidas na hierarquia da NR-01 (eliminação → substituição → engenharia
            → administrativo → EPI) a partir deste risco. Você revisa e escolhe.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={generating || pending}
          className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {generating ? "Consultando a IA pgr-e…" : "Sugerir medidas com a IA pgr-e"}
        </button>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

      {open ? (
        <ReviewModal
          suggestions={suggestions}
          requiresPlan={requiresPlan}
          selected={selected}
          onEdit={edit}
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
  requiresPlan,
  selected,
  generating,
  pending,
  onToggle,
  onEdit,
  onAccept,
  onClose,
}: {
  suggestions: AcceptedControlMeasure[];
  requiresPlan: boolean;
  selected: Set<number>;
  generating: boolean;
  pending: boolean;
  onToggle: (index: number) => void;
  onEdit: (index: number, patch: Partial<AcceptedControlMeasure>) => void;
  onAccept: () => void;
  onClose: () => void;
}) {
  const fieldClass = "glass-input text-text rounded-card px-2 py-1 text-sm outline-none";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Revisão de medidas de controle sugeridas pela IA pgr-e"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="glass-card flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-hidden bg-white/90 p-5">
        <header className="flex items-center justify-between">
          <h3 className="text-text text-lg font-semibold">
            {generating
              ? "Sugerindo medidas…"
              : `Medidas sugeridas (${suggestions.length})`}
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
            <AgentProgress stages={MEASURE_AGENT_STAGES} />
            <ul aria-hidden="true" className="flex flex-col gap-2 overflow-hidden">
              {[0, 1, 2].map((row) => (
                <li key={row} className="glass-panel rounded-card flex gap-3 p-3">
                  <Skeleton className="mt-1 size-4 rounded" />
                  <div className="flex w-full flex-col gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : suggestions.length === 0 ? (
          <p className="text-text-subtle text-sm">
            A IA pgr-e não sugeriu medidas — ou este risco já tem medida em todos os
            níveis, ou falta contexto (descrição, perigo e fontes geradoras).
          </p>
        ) : (
          <ul className="flex flex-col gap-2 overflow-y-auto">
            {requiresPlan ? (
              <li className="rounded-card border border-amber-300 bg-amber-50/70 px-3 py-2 text-sm text-amber-900">
                Risco moderado ou superior: responsável e prazo são obrigatórios em cada
                medida aplicável (NR-01). O agente não preenche esses dois — são
                compromisso de pessoa.
              </li>
            ) : null}
            {suggestions.map((s, index) => (
              <li key={index} className="glass-panel rounded-card flex gap-3 p-3">
                <input
                  type="checkbox"
                  checked={selected.has(index)}
                  onChange={() => onToggle(index)}
                  className="mt-1"
                  aria-label={`Selecionar medida: ${s.actionWhat}`}
                />
                <div className="flex flex-col gap-1">
                  <span className="text-text-muted inline-flex w-fit rounded bg-white/60 px-2 py-0.5 text-xs font-medium">
                    {controlLevelLabel(s.controlLevel)}
                  </span>
                  <span className="text-text font-medium">{s.actionWhat}</span>
                  <span className="text-text-muted text-sm">Como: {s.actionHow}</span>
                  {s.monitoring ? (
                    <span className="text-text-muted text-sm">
                      Monitoramento: {s.monitoring}
                    </span>
                  ) : null}
                  {s.justification ? (
                    <span className="text-text-subtle text-sm">{s.justification}</span>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-text-subtle text-xs">
                        Responsável{requiresPlan ? " *" : ""}
                      </span>
                      <input
                        value={s.actionResponsible ?? ""}
                        onChange={(e) =>
                          onEdit(index, { actionResponsible: e.target.value })
                        }
                        placeholder="Área ou função"
                        className={fieldClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-text-subtle text-xs">
                        Prazo{requiresPlan ? " *" : ""}
                      </span>
                      <input
                        type="date"
                        value={s.actionDeadline ?? ""}
                        onChange={(e) =>
                          onEdit(index, { actionDeadline: e.target.value })
                        }
                        className={fieldClass}
                      />
                    </label>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <footer className="flex items-center justify-between border-t border-white/50 pt-3">
          <span className="text-text-subtle text-sm">
            {generating ? "Aguardando o agente…" : `${selected.size} selecionada(s)`}
          </span>
          <button
            type="button"
            onClick={onAccept}
            disabled={generating || pending || selected.size === 0}
            className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Adicionando…" : "Adicionar selecionadas"}
          </button>
        </footer>
      </div>
    </div>
  );
}
