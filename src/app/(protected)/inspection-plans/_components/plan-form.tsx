"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  INSPECTION_FREQUENCY_LABELS,
  PLAN_STATUS_LABELS,
  PLAN_TYPE_LABELS,
} from "@/shared/domains/inspections/plans";
import {
  createPlanAction,
  updatePlanAction,
} from "@/shared/server/actions/inspections/plans";

import { FormActions, FormError, SubmitButton, TextField } from "../../_ui/form";

const TYPE_OPTIONS = Object.entries(PLAN_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const STATUS_OPTIONS = Object.entries(PLAN_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const FREQUENCY_OPTIONS = Object.entries(INSPECTION_FREQUENCY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

type ItemRow = { description: string; defaultValue: boolean };

export type PlanFormInitial = {
  type: string;
  subtype: string | null;
  title: string;
  description: string | null;
  frequency: string | null;
  status: string;
  items: ItemRow[];
};

export function PlanForm({ id, initial }: { id?: string; initial?: PlanFormInitial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [items, setItems] = useState<ItemRow[]>(
    initial?.items?.length ? initial.items : [{ description: "", defaultValue: false }],
  );

  function setItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      type: (fd.get("type") as "vehicular" | "equipment") ?? "vehicular",
      subtype: (fd.get("subtype") as string) ?? "",
      title: (fd.get("title") as string) ?? "",
      description: (fd.get("description") as string) ?? "",
      frequency: (fd.get("frequency") as string)?.trim() || undefined,
      status: ((fd.get("status") as string) || "active") as
        "active" | "draft" | "inactive",
      items: items.filter((it) => it.description.trim() !== ""),
    };
    startTransition(async () => {
      const result = id
        ? await updatePlanAction(id, input)
        : await createPlanAction(input);
      if (result.ok) {
        setFormError(null);
        router.push("/inspection-plans");
        router.refresh();
      } else {
        setFormError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4">
      <FormError message={formError} />
      <label className="flex flex-col gap-1">
        <span className="text-text-muted text-sm font-semibold">Tipo *</span>
        <select
          name="type"
          defaultValue={initial?.type ?? "vehicular"}
          className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <TextField label="Título" name="title" required defaultValue={initial?.title} />
      <TextField
        label="Categoria"
        name="subtype"
        placeholder="Ex.: Trabalho em Altura, Frota, NR-12"
        defaultValue={initial?.subtype}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-semibold">Frequência</span>
          <select
            name="frequency"
            defaultValue={initial?.frequency ?? ""}
            className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
          >
            <option value="">— sem frequência —</option>
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-semibold">Status</span>
          <select
            name="status"
            defaultValue={initial?.status ?? "active"}
            className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TextField
        label="Descrição"
        name="description"
        defaultValue={initial?.description}
      />

      <div className="flex flex-col gap-2">
        <span className="text-text-muted text-sm font-semibold">Itens do checklist</span>
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={item.description}
              onChange={(e) => setItem(index, { description: e.target.value })}
              placeholder={`Item ${index + 1}`}
              className="glass-input text-text rounded-card flex-1 px-3 py-2 text-sm outline-none"
            />
            <label className="text-text-subtle flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={item.defaultValue}
                onChange={(e) => setItem(index, { defaultValue: e.target.checked })}
              />
              padrão ✓
            </label>
            <button
              type="button"
              onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
              className="glass-panel text-text-muted rounded-card hover:text-text px-2 py-1 text-sm font-semibold transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setItems((prev) => [...prev, { description: "", defaultValue: false }])
          }
          className="glass-panel text-text-muted rounded-card hover:text-text w-fit px-3 py-1 text-sm font-semibold transition-colors"
        >
          + Adicionar item
        </button>
      </div>

      <FormActions>
        <SubmitButton pending={pending} label={id ? "Salvar" : "Criar plano"} />
      </FormActions>
    </form>
  );
}
