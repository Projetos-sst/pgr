"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AgentProgress } from "@/app/(protected)/_ui/agent-progress";
import {
  AiFillButton,
  AiFilledBadge,
  AiSaveConfirm,
  useAiGenerateWarning,
} from "@/app/(protected)/_ui/ai-review";
import { SelectField, TextAreaField, TextField } from "@/app/(protected)/_ui/form";
import { Skeleton } from "@/app/(protected)/_ui/skeleton";
import {
  controlMeasureDraftErrors,
  toControlMeasureDraft,
  type ControlMeasureDraft,
  type ControlMeasureDraftField,
} from "@/shared/domains/pgr/ai-control-measure-suggestion";
import {
  controlLevelLabel,
  controlLevelSchema,
  type ControlLevel,
} from "@/shared/domains/pgr/control-measure";
import { aiFillErrorMessage } from "@/shared/domains/platform/ai-review";
import {
  acceptSuggestedControlMeasures,
  suggestControlMeasures,
} from "@/shared/server/actions/pgr/ai-control-measures";

const MEASURE_AGENT_STAGES = [
  "Pensando…",
  "Lendo o risco e a classificação…",
  "Percorrendo a hierarquia da NR-01…",
  "Redigindo as ações…",
  "Preenchendo os campos…",
];

type MeasureCard = { id: number; values: ControlMeasureDraft };
type CardErrors = Partial<Record<ControlMeasureDraftField, string>>;

function duplicateLevelErrors(cards: MeasureCard[]): Map<number, CardErrors> {
  const seen = new Set<string>();
  const errors = new Map<number, CardErrors>();
  for (const card of cards) {
    if (seen.has(card.values.controlLevel)) {
      errors.set(card.id, { controlLevel: "Já existe outra medida neste nível." });
    }
    seen.add(card.values.controlLevel);
  }
  return errors;
}

function validateCards(
  cards: MeasureCard[],
  requiresPlan: boolean,
): Map<number, CardErrors> {
  const duplicates = duplicateLevelErrors(cards);
  const errors = new Map<number, CardErrors>();
  for (const card of cards) {
    const cardErrors = {
      ...controlMeasureDraftErrors(card.values, requiresPlan),
      ...duplicates.get(card.id),
    };
    if (Object.keys(cardErrors).length > 0) errors.set(card.id, cardErrors);
  }
  return errors;
}

export function SuggestMeasuresSection({ riskId }: { riskId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<MeasureCard[]>([]);
  const [requiresPlan, setRequiresPlan] = useState(false);
  const [existingLevels, setExistingLevels] = useState<ControlLevel[]>([]);
  const [cardErrors, setCardErrors] = useState<Map<number, CardErrors>>(new Map());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();
  const [pending, startAccept] = useTransition();

  function generate() {
    setError(null);
    setNotice(null);
    setCards([]);
    setCardErrors(new Map());
    setOpen(true);
    startGenerate(async () => {
      const result = await suggestControlMeasures(riskId);
      if (!result.ok) {
        setOpen(false);
        setError(aiFillErrorMessage(result.error));
        return;
      }
      setRequiresPlan(result.data.requiresResponsibleAndDeadline);
      setExistingLevels(result.data.existingLevels);
      setCards(
        result.data.suggestions.map((s, id) => ({
          id,
          values: toControlMeasureDraft(s),
        })),
      );
    });
  }

  const warning = useAiGenerateWarning(generate);

  function editCard(id: number, field: ControlMeasureDraftField, value: string) {
    setCards((prev) =>
      prev.map((card) =>
        card.id === id ? { id, values: { ...card.values, [field]: value } } : card,
      ),
    );
  }

  function removeCard(id: number) {
    setCards((prev) => prev.filter((card) => card.id !== id));
  }

  function requestSave() {
    const errors = validateCards(cards, requiresPlan);
    setCardErrors(errors);
    if (errors.size > 0) {
      setError("Revise os campos destacados antes de salvar.");
      return;
    }
    setError(null);
    setConfirming(true);
  }

  function save() {
    startAccept(async () => {
      const result = await acceptSuggestedControlMeasures(riskId, {
        suggestions: cards.map((card) => card.values),
      });
      setConfirming(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setOpen(false);
      setCards([]);
      setNotice(`${result.data.created} medida(s) salva(s) no risco.`);
      router.refresh();
    });
  }

  return (
    <section className="glass-card flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-text text-lg font-semibold">
            Preenchimento de medidas com a IA pgr-e
          </h2>
          <p className="text-text-subtle text-sm">
            A IA preenche as medidas na hierarquia da NR-01 (eliminação → substituição →
            engenharia → administrativo → EPI) a partir deste risco. Você revisa, edita e
            confirma antes de salvar.
          </p>
        </div>
        <AiFillButton onClick={warning.request} pending={generating} disabled={pending} />
      </header>

      {error && !open ? <p className="text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

      {open ? (
        <ReviewModal
          cards={cards}
          requiresPlan={requiresPlan}
          existingLevels={existingLevels}
          cardErrors={cardErrors}
          generating={generating}
          pending={pending}
          error={error}
          onEdit={editCard}
          onRemove={removeCard}
          onSave={requestSave}
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
  requiresPlan,
  existingLevels,
  cardErrors,
  generating,
  pending,
  error,
  onEdit,
  onRemove,
  onSave,
  onClose,
}: {
  cards: MeasureCard[];
  requiresPlan: boolean;
  existingLevels: ControlLevel[];
  cardErrors: Map<number, CardErrors>;
  generating: boolean;
  pending: boolean;
  error: string | null;
  onEdit: (id: number, field: ControlMeasureDraftField, value: string) => void;
  onRemove: (id: number) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const levelOptions = controlLevelSchema.options
    .filter((level) => !existingLevels.includes(level))
    .map((level) => ({ value: level, label: controlLevelLabel(level) }));
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Revisão das medidas preenchidas pela IA pgr-e"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="glass-card flex max-h-[85vh] w-full max-w-3xl flex-col gap-4 overflow-hidden bg-white/90 p-5">
        <header className="flex items-center justify-between">
          <h3 className="text-text text-lg font-semibold">
            {generating
              ? "Preenchendo medidas…"
              : `Medidas preenchidas (${cards.length})`}
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
            A IA pgr-e não preencheu medidas — ou este risco já tem medida em todos os
            níveis, ou falta contexto (descrição, perigo e fontes geradoras).
          </p>
        ) : null}
        {!generating && cards.length > 0 ? (
          <div className="flex flex-col gap-3 overflow-y-auto">
            {requiresPlan ? (
              <p className="rounded-card border border-amber-300 bg-amber-50/70 px-3 py-2 text-sm text-amber-900">
                Risco moderado ou superior: responsável e prazo são obrigatórios em cada
                medida (NR-01). A IA não preenche esses dois — são compromisso de pessoa.
              </p>
            ) : null}
            {cards.map((card, index) => (
              <MeasureCardFields
                key={card.id}
                title={`Medida ${index + 1}`}
                card={card}
                levelOptions={levelOptions}
                requiresPlan={requiresPlan}
                errors={cardErrors.get(card.id) ?? {}}
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
            {pending ? "Salvando…" : "Salvar medidas"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function GeneratingState() {
  return (
    <>
      <AgentProgress stages={MEASURE_AGENT_STAGES} />
      <ul aria-hidden="true" className="flex flex-col gap-2 overflow-hidden">
        {[0, 1, 2].map((row) => (
          <li key={row} className="glass-panel rounded-card flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </li>
        ))}
      </ul>
    </>
  );
}

function MeasureCardFields({
  title,
  card,
  levelOptions,
  requiresPlan,
  errors,
  onEdit,
  onRemove,
}: {
  title: string;
  card: MeasureCard;
  levelOptions: { value: string; label: string }[];
  requiresPlan: boolean;
  errors: CardErrors;
  onEdit: (id: number, field: ControlMeasureDraftField, value: string) => void;
  onRemove: (id: number) => void;
}) {
  const { id, values } = card;
  const prefix = `measure-${id}`;
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
          label="Nível de controle"
          name={`${prefix}-controlLevel`}
          required
          value={values.controlLevel}
          onChange={(v) => onEdit(id, "controlLevel", v)}
          options={levelOptions}
          error={errors.controlLevel}
          isFullWidth
        />
        <TextField
          label="O que será feito"
          name={`${prefix}-actionWhat`}
          required
          value={values.actionWhat}
          onChange={(v) => onEdit(id, "actionWhat", v)}
          error={errors.actionWhat}
          isFullWidth
        />
        <TextAreaField
          label="Por que"
          name={`${prefix}-actionWhy`}
          rows={2}
          value={values.actionWhy}
          onChange={(v) => onEdit(id, "actionWhy", v)}
        />
        <TextAreaField
          label="Como"
          name={`${prefix}-actionHow`}
          required
          rows={3}
          value={values.actionHow}
          onChange={(v) => onEdit(id, "actionHow", v)}
          error={errors.actionHow}
        />
        <TextAreaField
          label="Monitoramento"
          name={`${prefix}-monitoring`}
          rows={2}
          value={values.monitoring}
          onChange={(v) => onEdit(id, "monitoring", v)}
        />
        <TextAreaField
          label="Justificativa"
          name={`${prefix}-justification`}
          rows={2}
          value={values.justification}
          onChange={(v) => onEdit(id, "justification", v)}
        />
        <TextField
          label="Responsável"
          name={`${prefix}-actionResponsible`}
          required={requiresPlan}
          placeholder="Área ou função"
          value={values.actionResponsible}
          onChange={(v) => onEdit(id, "actionResponsible", v)}
          error={errors.actionResponsible}
        />
        <TextField
          label="Prazo"
          name={`${prefix}-actionDeadline`}
          type="date"
          required={requiresPlan}
          value={values.actionDeadline}
          onChange={(v) => onEdit(id, "actionDeadline", v)}
          error={errors.actionDeadline}
        />
      </div>
    </fieldset>
  );
}
