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
import { SelectField, TextField } from "@/app/(protected)/_ui/form";
import { Skeleton } from "@/app/(protected)/_ui/skeleton";
import {
  toTrainingDraft,
  trainingDraftErrors,
  type MatchedTrainingSuggestion,
  type TrainingDraft,
  type TrainingDraftField,
} from "@/shared/domains/pgr/ai-training-suggestion";
import {
  TRAINING_PERIODICITIES,
  trainingPeriodicityLabel,
} from "@/shared/domains/pgr/trainings";
import { aiFillErrorMessage } from "@/shared/domains/platform/ai-review";
import {
  acceptSuggestedTrainings,
  suggestRequiredTrainings,
} from "@/shared/server/actions/pgr/ai-required-trainings";

const TRAINING_AGENT_STAGES = [
  "Pensando…",
  "Lendo a função e o GES…",
  "Cruzando com os riscos da exposição…",
  "Selecionando as NRs aplicáveis…",
  "Conferindo com o catálogo…",
];

const PERIODICITY_OPTIONS = TRAINING_PERIODICITIES.map((p) => ({
  value: p,
  label: trainingPeriodicityLabel(p),
}));

type TrainingCard = {
  id: number;
  values: TrainingDraft;
  trainingId: string | null;
  rationale: string | undefined;
};
type CardErrors = Partial<Record<TrainingDraftField, string>>;

function validateCards(cards: TrainingCard[]): Map<number, CardErrors> {
  const errors = new Map<number, CardErrors>();
  for (const card of cards) {
    const cardErrors = trainingDraftErrors(card.values);
    if (Object.keys(cardErrors).length > 0) errors.set(card.id, cardErrors);
  }
  return errors;
}

function toCards(suggestions: MatchedTrainingSuggestion[]): TrainingCard[] {
  return suggestions.flatMap((s, id) =>
    s.alreadyRequired
      ? []
      : [
          {
            id,
            values: toTrainingDraft(s),
            trainingId: s.trainingId,
            rationale: s.rationale,
          },
        ],
  );
}

function linkedNotice(linked: number, createdInCatalog: number): string {
  if (createdInCatalog === 0) return `${linked} treinamento(s) vinculado(s) à função.`;
  return `${linked} treinamento(s) vinculado(s) — ${createdInCatalog} criado(s) no catálogo.`;
}

export function SuggestTrainingsSection({ jobRoleId }: { jobRoleId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<TrainingCard[]>([]);
  const [alreadyRequired, setAlreadyRequired] = useState<string[]>([]);
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
    setAlreadyRequired([]);
    setCardErrors(new Map());
    setOpen(true);
    startGenerate(async () => {
      const result = await suggestRequiredTrainings(jobRoleId);
      if (!result.ok) {
        setOpen(false);
        setError(aiFillErrorMessage(result.error));
        return;
      }
      setCards(toCards(result.data.suggestions));
      setAlreadyRequired(
        result.data.suggestions.filter((s) => s.alreadyRequired).map((s) => s.name),
      );
    });
  }

  const warning = useAiGenerateWarning(generate);

  function editCard(id: number, field: TrainingDraftField, value: string) {
    setCards((prev) =>
      prev.map((card) =>
        card.id === id ? { ...card, values: { ...card.values, [field]: value } } : card,
      ),
    );
  }

  function removeCard(id: number) {
    setCards((prev) => prev.filter((card) => card.id !== id));
  }

  function requestSave() {
    const errors = validateCards(cards);
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
      const result = await acceptSuggestedTrainings(jobRoleId, {
        suggestions: cards.map((card) => ({
          name: card.values.name,
          referenceNorm: card.values.referenceNorm,
          periodicity: card.values.periodicity,
          workloadHours: Number(card.values.workloadHours),
          rationale: card.rationale,
          trainingId: card.trainingId,
        })),
      });
      setConfirming(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setOpen(false);
      setCards([]);
      setNotice(linkedNotice(result.data.linked, result.data.createdInCatalog));
      router.refresh();
    });
  }

  return (
    <section className="glass-card flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-text text-lg font-semibold">
            Preenchimento de obrigatórios com a IA pgr-e
          </h2>
          <p className="text-text-subtle text-sm">
            A IA preenche os treinamentos exigidos para esta função a partir do cargo, do
            GES e dos riscos da exposição. Você revisa, edita e confirma antes de
            vincular.
          </p>
        </div>
        <AiFillButton onClick={warning.request} pending={generating} disabled={pending} />
      </header>

      {error && !open ? <p className="text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

      {open ? (
        <ReviewModal
          cards={cards}
          alreadyRequired={alreadyRequired}
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
  alreadyRequired,
  cardErrors,
  generating,
  pending,
  error,
  onEdit,
  onRemove,
  onSave,
  onClose,
}: {
  cards: TrainingCard[];
  alreadyRequired: string[];
  cardErrors: Map<number, CardErrors>;
  generating: boolean;
  pending: boolean;
  error: string | null;
  onEdit: (id: number, field: TrainingDraftField, value: string) => void;
  onRemove: (id: number) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const empty = !generating && cards.length === 0 && alreadyRequired.length === 0;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Revisão dos treinamentos preenchidos pela IA pgr-e"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="glass-card flex max-h-[85vh] w-full max-w-3xl flex-col gap-4 overflow-hidden bg-white/90 p-5">
        <header className="flex items-center justify-between">
          <h3 className="text-text text-lg font-semibold">
            {generating
              ? "Preenchendo treinamentos…"
              : `Treinamentos preenchidos (${cards.length})`}
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
        {empty ? (
          <p className="text-text-subtle text-sm">
            A IA pgr-e não preencheu treinamentos — descreva melhor a função e o GES
            (processo, ambiente e riscos) e tente novamente.
          </p>
        ) : null}
        {!generating && !empty ? (
          <div className="flex flex-col gap-3 overflow-y-auto">
            {cards.map((card, index) => (
              <TrainingCardFields
                key={card.id}
                title={`Treinamento ${index + 1}`}
                card={card}
                errors={cardErrors.get(card.id) ?? {}}
                onEdit={onEdit}
                onRemove={onRemove}
              />
            ))}
            <AlreadyRequiredList names={alreadyRequired} />
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
            {pending ? "Vinculando…" : "Salvar treinamentos"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function GeneratingState() {
  return (
    <>
      <AgentProgress stages={TRAINING_AGENT_STAGES} />
      <ul aria-hidden="true" className="flex flex-col gap-2 overflow-hidden">
        {[0, 1, 2].map((row) => (
          <li key={row} className="glass-panel rounded-card flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-2/3" />
          </li>
        ))}
      </ul>
    </>
  );
}

function AlreadyRequiredList({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <section className="glass-panel rounded-card flex flex-col gap-1 p-3">
      <h4 className="text-text-muted text-sm font-semibold">
        Já obrigatório nesta função — não será adicionado de novo
      </h4>
      <ul className="text-text-subtle text-sm">
        {names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </section>
  );
}

function TrainingCardFields({
  title,
  card,
  errors,
  onEdit,
  onRemove,
}: {
  title: string;
  card: TrainingCard;
  errors: CardErrors;
  onEdit: (id: number, field: TrainingDraftField, value: string) => void;
  onRemove: (id: number) => void;
}) {
  const { id, values, trainingId } = card;
  const inCatalog = trainingId !== null;
  const prefix = `training-${id}`;
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
      <p className="text-text-subtle text-xs">
        {inCatalog
          ? "Já existe no catálogo — será apenas vinculado, com os dados do catálogo."
          : "Novo no catálogo — será criado ao salvar."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Nome"
          name={`${prefix}-name`}
          required
          readOnly={inCatalog}
          value={values.name}
          onChange={(v) => onEdit(id, "name", v)}
          error={errors.name}
          isFullWidth
        />
        <TextField
          label="Norma de referência"
          name={`${prefix}-referenceNorm`}
          readOnly={inCatalog}
          value={values.referenceNorm}
          onChange={(v) => onEdit(id, "referenceNorm", v)}
        />
        <SelectField
          label="Periodicidade"
          name={`${prefix}-periodicity`}
          required
          disabled={inCatalog}
          value={values.periodicity}
          onChange={(v) => onEdit(id, "periodicity", v)}
          options={PERIODICITY_OPTIONS}
          error={errors.periodicity}
        />
        <TextField
          label="Carga horária (h)"
          name={`${prefix}-workloadHours`}
          type="number"
          required
          readOnly={inCatalog}
          value={values.workloadHours}
          onChange={(v) => onEdit(id, "workloadHours", v)}
          error={errors.workloadHours}
        />
      </div>
      {card.rationale ? (
        <p className="text-text-subtle text-sm">{card.rationale}</p>
      ) : null}
    </fieldset>
  );
}
