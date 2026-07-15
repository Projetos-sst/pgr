"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import type { ChecklistRow } from "@/shared/domains/inspections/vehicular-inspections";
import { saveChecklistAction } from "@/shared/server/actions/inspections/vehicular-inspections";

import { FormActions, FormError, SubmitButton } from "../../_ui/form";

type RowState = { planItemId: string; value: boolean | null; observation: string };

// tri-state: null (N/A) → true (conforme) → false (não conforme)
const VALUE_OPTIONS: { key: string; label: string; value: boolean | null }[] = [
  { key: "ok", label: "Conforme", value: true },
  { key: "nok", label: "Não conforme", value: false },
  { key: "na", label: "N/A", value: null },
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
        router.push("/inspecoes-veiculares");
        router.refresh();
      } else {
        setFormError(result.error.message);
      }
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        O plano desta inspeção não possui itens de checklist.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormError message={formError} />
      <ul className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
        {items.map((item, index) => (
          <li key={item.planItemId} className="flex flex-col gap-2 py-3">
            <span className="text-sm font-medium">{item.description}</span>
            <div className="flex flex-wrap gap-3">
              {VALUE_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name={`value-${index}`}
                    checked={rows[index].value === opt.value}
                    onChange={() => setRow(index, { value: opt.value })}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <input
              value={rows[index].observation}
              onChange={(e) => setRow(index, { observation: e.target.value })}
              placeholder="Observação (opcional)"
              className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-900"
            />
          </li>
        ))}
      </ul>
      <FormActions>
        <SubmitButton pending={pending} label="Concluir inspeção" />
      </FormActions>
    </form>
  );
}
