"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  QUESTION_TYPE_LABELS,
  questionTypeLabel,
  type PsychosocialQuestion,
  type QuestionValues,
} from "@/shared/domains/psychosocial/campaigns";
import {
  addQuestionAction,
  removeQuestionAction,
  reorderQuestionAction,
} from "@/shared/server/actions/psychosocial/campaigns";

import { FormError } from "../../../_ui/form";

const TYPE_OPTIONS = Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function QuestionsEditor({
  campaignId,
  questions,
}: {
  campaignId: string;
  questions: PsychosocialQuestion[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<QuestionValues["questionType"]>("likert");

  function refresh() {
    router.refresh();
  }

  function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const input = {
      text: (fd.get("text") as string) ?? "",
      questionType: type,
      options: (fd.get("options") as string) ?? "",
    };
    startTransition(async () => {
      const r = await addQuestionAction(campaignId, input);
      if (r.ok) {
        setError(null);
        form.reset();
        setType("likert");
        refresh();
      } else {
        setError(r.error.message);
      }
    });
  }

  function onRemove(questionId: string) {
    if (!window.confirm("Remover esta pergunta?")) return;
    startTransition(async () => {
      const r = await removeQuestionAction(campaignId, questionId);
      if (r.ok) refresh();
      else setError(r.error.message);
    });
  }

  function onReorder(questionId: string, direction: "up" | "down") {
    startTransition(async () => {
      const r = await reorderQuestionAction(campaignId, questionId, direction);
      if (r.ok) refresh();
      else setError(r.error.message);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <FormError message={error} />

      {questions.length === 0 ? (
        <p className="text-text-subtle text-sm">
          Nenhuma pergunta ainda. Adicione a primeira abaixo.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {questions.map((q, index) => (
            <li key={q.id} className="glass-card flex items-start gap-3 p-3">
              <span className="text-text-subtle mt-1 text-sm tabular-nums">
                {index + 1}.
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">{q.text}</p>
                <p className="text-text-subtle text-xs">
                  {questionTypeLabel(q.questionType)}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={pending || index === 0}
                  onClick={() => onReorder(q.id, "up")}
                  className="glass-panel text-text-muted rounded-card hover:text-text px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={pending || index === questions.length - 1}
                  onClick={() => onReorder(q.id, "down")}
                  className="glass-panel text-text-muted rounded-card hover:text-text px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onRemove(q.id)}
                  className="rounded-card border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={onAdd} className="glass-card flex flex-col gap-3 p-4">
        <span className="text-sm font-medium">Adicionar pergunta</span>
        <input
          name="text"
          required
          placeholder="Texto da pergunta"
          className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
        />
        <select
          name="questionType"
          value={type}
          onChange={(e) => setType(e.target.value as QuestionValues["questionType"])}
          className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {type === "multiple_choice" ? (
          <textarea
            name="options"
            placeholder="Uma opção por linha"
            rows={3}
            className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
          />
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="btn-primary rounded-pill w-fit px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Adicionar
        </button>
      </form>
    </div>
  );
}
