"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  OCCURRENCE_SEVERITY_LABELS,
  type OccurrenceSeverityKey,
} from "@/shared/domains/inspections/safety-inspections";
import { saveOccurrencesAction } from "@/shared/server/actions/inspections/safety-inspections";

import { FormActions, FormError, SubmitButton } from "../../_ui/form";

type Row = { description: string; severity: OccurrenceSeverityKey | "" };

const SEVERITY_OPTIONS = Object.entries(OCCURRENCE_SEVERITY_LABELS) as [
  OccurrenceSeverityKey,
  string,
][];

export type OccurrenceInitial = { description: string; severity: string | null };

export function OccurrencesForm({
  inspectionId,
  initial,
}: {
  inspectionId: string;
  initial: OccurrenceInitial[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>(
    initial.length
      ? initial.map((o) => ({
          description: o.description,
          severity: (o.severity as OccurrenceSeverityKey | null) ?? "",
        }))
      : [],
  );

  function setRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveOccurrencesAction(inspectionId, {
        occurrences: rows
          .filter((r) => r.description.trim() !== "")
          .map((r) => ({
            description: r.description,
            severity: r.severity === "" ? null : r.severity,
          })),
      });
      if (result.ok) {
        setFormError(null);
        router.push("/inspecoes-seguranca");
        router.refresh();
      } else {
        setFormError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormError message={formError} />
      {rows.length === 0 ? (
        <p className="text-text-subtle text-sm">
          Nenhuma ocorrência. Adicione abaixo ou conclua sem ocorrências.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <li
              key={index}
              className="glass-card flex flex-col gap-2 p-3 sm:flex-row sm:items-start"
            >
              <input
                value={row.description}
                onChange={(e) => setRow(index, { description: e.target.value })}
                placeholder={`Ocorrência ${index + 1}`}
                className="glass-input text-text rounded-card flex-1 px-3 py-2 text-sm outline-none"
              />
              <select
                value={row.severity}
                onChange={(e) =>
                  setRow(index, { severity: e.target.value as Row["severity"] })
                }
                className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
              >
                <option value="">— severidade —</option>
                {SEVERITY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                className="glass-panel text-text-muted rounded-card hover:text-text px-2 py-1 text-sm font-semibold transition-colors"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, { description: "", severity: "" }])}
        className="glass-panel text-text-muted rounded-card hover:text-text w-fit px-3 py-1 text-sm font-semibold transition-colors"
      >
        + Adicionar ocorrência
      </button>
      <FormActions>
        <SubmitButton pending={pending} label="Salvar ocorrências e concluir" />
      </FormActions>
    </form>
  );
}
