"use client";

import { useState, type FormEvent } from "react";

import { submitPsychosocialResponse } from "@/shared/server/actions/public-psychosocial";
import { parseOptions } from "@/shared/domains/psychosocial/campaigns";

type Question = {
  id: string;
  text: string;
  questionType: string;
  options: string | null;
  position: number;
};

const LIKERT = [1, 2, 3, 4, 5];

export function PublicQuestionnaire({
  campaignId,
  token,
  questions,
}: {
  campaignId: string;
  token: string;
  questions: Question[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<
    Record<string, { valueInt?: number | null; valueText?: string }>
  >({});

  function setAnswer(
    qid: string,
    patch: { valueInt?: number | null; valueText?: string },
  ) {
    setValues((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const answers = questions.map((q) => ({
      questionId: q.id,
      valueInt: values[q.id]?.valueInt ?? null,
      valueText: values[q.id]?.valueText ?? null,
    }));
    const result = await submitPsychosocialResponse(campaignId, token, { answers });
    setSubmitting(false);
    if (result.ok) setDone(true);
    else setError(result.error.message);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-300 bg-green-50 p-8 text-center dark:border-green-900 dark:bg-green-950/40">
        <h2 className="text-lg font-semibold text-green-800 dark:text-green-300">
          Obrigado pela sua participação!
        </h2>
        <p className="mt-1 text-sm text-green-700 dark:text-green-400">
          Suas respostas foram registradas anonimamente.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {questions.map((q, index) => (
        <div key={q.id} className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            {index + 1}. {q.text}
          </label>
          {q.questionType === "likert" ? (
            <div className="flex gap-2">
              {LIKERT.map((n) => (
                <label
                  key={n}
                  className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border text-sm ${
                    values[q.id]?.valueInt === n
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-black/20 dark:border-white/20"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    className="sr-only"
                    checked={values[q.id]?.valueInt === n}
                    onChange={() => setAnswer(q.id, { valueInt: n })}
                  />
                  {n}
                </label>
              ))}
            </div>
          ) : q.questionType === "multiple_choice" ? (
            <div className="flex flex-col gap-1">
              {parseOptions(q.options).map((opt, i) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={values[q.id]?.valueInt === i}
                    onChange={() => setAnswer(q.id, { valueInt: i })}
                  />
                  {opt}
                </label>
              ))}
            </div>
          ) : (
            <textarea
              rows={3}
              maxLength={2000}
              value={values[q.id]?.valueText ?? ""}
              onChange={(e) => setAnswer(q.id, { valueText: e.target.value })}
              className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-900"
            />
          )}
        </div>
      ))}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {submitting ? "Enviando…" : "Enviar respostas"}
      </button>
    </form>
  );
}
