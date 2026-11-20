"use client";

import { useState, useTransition } from "react";

import { AgentProgress } from "@/app/(protected)/_ui/agent-progress";
import {
  AiFillButton,
  AiFilledBadge,
  AiSaveConfirm,
  useAiGenerateWarning,
} from "@/app/(protected)/_ui/ai-review";
import { SelectField, TextField } from "@/app/(protected)/_ui/form";
import { Skeleton } from "@/app/(protected)/_ui/skeleton";
import {
  suggestRisks,
  acceptSuggestedRisks,
} from "@/shared/server/actions/pgr/ai-risk-suggestion";
import { toRiskDraft, type RiskDraft } from "@/shared/domains/pgr/ai-risk-suggestion";
import { aiFillErrorMessage } from "@/shared/domains/platform/ai-review";
import {
  exposureTimeLabel,
  exposureTimeSchema,
  riskAgentTypeLabel,
  riskAgentTypeSchema,
} from "@/shared/domains/pgr/risks";

const RISK_AGENT_STAGES = [
  "Pensando…",
  "Lendo o contexto do GES…",
  "Mapeando riscos…",
  "Classificando os agentes de risco…",
  "Preenchendo os campos…",
];

const AGENT_TYPE_OPTIONS = riskAgentTypeSchema.options.map((v) => ({
  value: v,
  label: riskAgentTypeLabel(v),
}));

const EXPOSURE_TIME_OPTIONS = exposureTimeSchema.options.map((v) => ({
  value: v,
  label: exposureTimeLabel(v),
}));

type DraftCard = { id: number; values: RiskDraft };

export function SuggestRisksSection({ gesId }: { gesId: string }) {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<DraftCard[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    setNotice(null);
    setCards([]);
    setOpen(true);
    startGenerate(async () => {
      const result = await suggestRisks(gesId);
      if (!result.ok) {
        setOpen(false);
        setError(aiFillErrorMessage(result.error));
        return;
      }
      setCards(result.data.suggestions.map((s, id) => ({ id, values: toRiskDraft(s) })));
    });
  }

  const warning = useAiGenerateWarning(generate);

  function editCard(id: number, field: keyof RiskDraft, value: string) {
    setCards((prev) =>
      prev.map((card) =>
        card.id === id ? { id, values: { ...card.values, [field]: value } } : card,
      ),
    );
  }

  function removeCard(id: number) {
    setCards((prev) => prev.filter((card) => card.id !== id));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await acceptSuggestedRisks(gesId, {
        suggestions: cards.map((card) => card.values),
      });
      setConfirming(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setOpen(false);
      setCards([]);
      setNotice(
        `${result.data.created} risco(s) salvo(s) como rascunho. Complete a avaliação e os controles em cada risco.`,
      );
    });
  }

  return (
    <section className="glass-card flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-text text-lg font-semibold">
            Preenchimento de riscos com a IA pgr-e
          </h2>
          <p className="text-text-subtle text-sm">
            A IA preenche os riscos a partir do processo, ambiente e funções deste GES.
            Você revisa, edita e confirma antes de salvar.
          </p>
        </div>
        <AiFillButton onClick={warning.request} pending={generating} disabled={pending} />
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

      {open ? (
        <ReviewModal
          cards={cards}
          generating={generating}
          pending={pending}
          error={error}
          onEdit={editCard}
          onRemove={removeCard}
          onSave={() => setConfirming(true)}
          onClose={() => setOpen(false)}
        />
      ) : null}

      {warning.modal}
      <AiSaveConfirm
        open={confirming}
        pending={pending}
        onConfirm={save}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}

function ReviewModal({
  cards,
  generating,
  pending,
  error,
  onEdit,
  onRemove,
  onSave,
  onClose,
}: {
  cards: DraftCard[];
  generating: boolean;
  pending: boolean;
  error: string | null;
  onEdit: (id: number, field: keyof RiskDraft, value: string) => void;
  onRemove: (id: number) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Revisão dos riscos preenchidos pela IA pgr-e"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="glass-card flex max-h-[85vh] w-full max-w-3xl flex-col gap-4 overflow-hidden bg-white/90 p-5">
        <header className="flex items-center justify-between">
          <h3 className="text-text text-lg font-semibold">
            {generating ? "Preenchendo riscos…" : `Riscos preenchidos (${cards.length})`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
          >
            Fechar
          </button>
        </header>

        {generating ? <GeneratingState /> : null}
        {!generating && cards.length === 0 ? (
          <p className="text-text-subtle text-sm">
            A IA pgr-e não preencheu nenhum risco. Descreva melhor o processo e o ambiente
            do GES e tente novamente.
          </p>
        ) : null}
        {!generating && cards.length > 0 ? (
          <div className="flex flex-col gap-3 overflow-y-auto">
            {cards.map((card, index) => (
              <RiskCard
                key={card.id}
                title={`Risco ${index + 1}`}
                card={card}
                onEdit={onEdit}
                onRemove={onRemove}
              />
            ))}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <footer className="flex items-center justify-between border-t border-white/50 pt-3">
          <span className="text-text-subtle text-sm">
            {generating ? "Aguardando o agente…" : "Revise cada campo antes de salvar."}
          </span>
          <button
            type="button"
            onClick={onSave}
            disabled={generating || pending || cards.length === 0}
            className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Salvar riscos"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function GeneratingState() {
  return (
    <>
      <AgentProgress stages={RISK_AGENT_STAGES} />
      <ul aria-hidden="true" className="flex flex-col gap-2 overflow-hidden">
        {[0, 1, 2].map((row) => (
          <li key={row} className="glass-panel rounded-card flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </li>
        ))}
      </ul>
    </>
  );
}

function RiskCard({
  title,
  card,
  onEdit,
  onRemove,
}: {
  title: string;
  card: DraftCard;
  onEdit: (id: number, field: keyof RiskDraft, value: string) => void;
  onRemove: (id: number) => void;
}) {
  const { id, values } = card;
  const prefix = `risk-${id}`;
  return (
    <fieldset className="glass-panel rounded-card flex flex-col gap-3 p-3">
      <legend className="sr-only">{title}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-text text-sm font-semibold">{title}</span>
          <AiFilledBadge />
        </div>
        <button
          type="button"
          onClick={() => onRemove(id)}
          className="text-sm font-semibold text-red-600 hover:underline"
        >
          Remover
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Grupo do agente"
          name={`${prefix}-agentType`}
          required
          value={values.agentType}
          onChange={(v) => onEdit(id, "agentType", v)}
          options={AGENT_TYPE_OPTIONS}
        />
        <SelectField
          label="Tempo de exposição"
          name={`${prefix}-exposureTime`}
          value={values.exposureTime}
          onChange={(v) => onEdit(id, "exposureTime", v)}
          options={EXPOSURE_TIME_OPTIONS}
          emptyLabel="— não informado —"
        />
        <TextField
          label="Descrição"
          name={`${prefix}-description`}
          required
          value={values.description}
          onChange={(v) => onEdit(id, "description", v)}
          isFullWidth
        />
        <TextField
          label="Perigo"
          name={`${prefix}-hazard`}
          value={values.hazard}
          onChange={(v) => onEdit(id, "hazard", v)}
        />
        <TextField
          label="Fontes geradoras"
          name={`${prefix}-sources`}
          value={values.sources}
          onChange={(v) => onEdit(id, "sources", v)}
        />
        <TextField
          label="Meios de propagação"
          name={`${prefix}-propagation`}
          value={values.propagation}
          onChange={(v) => onEdit(id, "propagation", v)}
        />
        <TextField
          label="Possíveis lesões"
          name={`${prefix}-possibleInjuries`}
          value={values.possibleInjuries}
          onChange={(v) => onEdit(id, "possibleInjuries", v)}
        />
      </div>
    </fieldset>
  );
}
