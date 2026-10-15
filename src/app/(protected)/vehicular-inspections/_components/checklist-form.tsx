"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import type { ChecklistRow } from "@/shared/domains/inspections/vehicular-inspections";
import { saveChecklistAction } from "@/shared/server/actions/inspections/vehicular-inspections";

import { FormActions, FormError, SubmitButton } from "../../_ui/form";

type RowState = { planItemId: string; value: boolean | null; observation: string };

// tri-state: null (N/A) → true (conforme) → false (não conforme)
const VALUE_OPTIONS: {
  key: string;
  label: string;
  value: boolean | null;
  selectedClass: string;
}[] = [
  {
    key: "ok",
    label: "Conforme",
    value: true,
    selectedClass: "bg-accent-green/15 text-accent-green border-accent-green/40",
  },
  {
    key: "nok",
    label: "Não conforme",
    value: false,
    selectedClass: "bg-danger/15 text-danger border-danger/40",
  },
  {
    key: "na",
    label: "N/A",
    value: null,
    selectedClass: "bg-text-subtle/15 text-text-muted border-text-subtle/40",
  },
];

export function ChecklistForm({
  inspectionId,
  items,
}: {
  inspectionId: string;
  items: ChecklistRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [rows, setRows] = useState<RowState[]>(
    items.map((it) => ({
      planItemId: it.planItemId,
      value: it.value ?? (it.defaultValue ? true : null),
      observation: it.observation ?? "",
    })),
  );

  function setRow(index: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveChecklistAction(inspectionId, {
        responses: rows.map((r) => ({
          planItemId: r.planItemId,
          value: r.value,
          observation: r.observation,
        })),
      });
      if (result.ok) {
        setFormError(null);
        router.push("/vehicular-inspections");
        router.refresh();
      } else {
        setFormError(result.error.message);
      }
    });
  }

  if (items.length === 0) {
    return (
      <section className="glass-card rounded-[20px] p-8 text-center">
        <p className="text-text-subtle text-[13px]">
          O plano desta inspeção não possui itens de checklist.
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormError message={formError} />

      <section className="glass-card overflow-hidden rounded-[20px]">
        <h2 className="text-primary border-b border-black/5 px-5 py-4 font-mono text-[11px] tracking-[0.14em] uppercase sm:px-6">
          Itens do checklist ({items.length})
        </h2>
        <ul className="divide-y divide-black/5">
          {items.map((item, index) => (
            <li
              key={item.planItemId}
              className="flex flex-col gap-3 px-5 py-4 transition-colors duration-200 odd:bg-white/20 hover:bg-white/40 sm:px-6"
            >
              <fieldset className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <legend className="contents">
                  <span className="text-text flex items-start gap-2.5 text-[13px] font-semibold">
                    <span
                      aria-hidden
                      className="text-text-subtle mt-px font-mono text-[11px]"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item.description}
                  </span>
                </legend>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {VALUE_OPTIONS.map((opt) => {
                    const isSelected = rows[index].value === opt.value;
                    return (
                      <label
                        key={opt.key}
                        className={`rounded-pill cursor-pointer border px-3 py-1.5 text-[11px] font-bold transition-all has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-[var(--color-primary-ring)] ${
                          isSelected
                            ? opt.selectedClass
                            : "text-text-subtle hover:text-text border-transparent bg-white/40 hover:bg-white/70"
                        }`}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={`value-${index}`}
                          checked={isSelected}
                          onChange={() => setRow(index, { value: opt.value })}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <label className="block">
                <span className="sr-only">Observação do item {index + 1}</span>
                <input
                  value={rows[index].observation}
                  onChange={(e) => setRow(index, { observation: e.target.value })}
                  placeholder="Observação (opcional)"
                  className="glass-input text-text placeholder:text-text-subtle rounded-field h-10 w-full px-3.5 text-[13px] outline-none"
                />
              </label>
            </li>
          ))}
        </ul>
      </section>

      <FormActions>
        <SubmitButton pending={pending} label="Concluir inspeção" />
      </FormActions>
    </form>
  );
}
