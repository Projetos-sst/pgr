"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  INSPECTION_CATEGORY_LABELS,
  type InspectionCategoryKey,
} from "@/shared/domains/inspections/safety-inspections";
import {
  createSafetyInspectionAction,
  updateSafetyInspectionHeaderAction,
} from "@/shared/server/actions/inspections/safety-inspections";

import {
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

type Option = { value: string; label: string };

const CATEGORY_OPTIONS = Object.entries(INSPECTION_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export type SafetyHeaderInitial = {
  category: string;
  inspectedAt: string;
  planned: boolean;
  area: string | null;
  companyId: string | null;
  responsible: string | null;
  notes: string | null;
};

export function HeaderForm({
  id,
  companies,
  initial,
}: {
  id?: string;
  companies: Option[];
  initial?: SafetyHeaderInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const companyId = (fd.get("companyId") as string)?.trim();
    const input = {
      category: (fd.get("category") as InspectionCategoryKey) ?? "safety",
      inspectedAt: (fd.get("inspectedAt") as string) ?? "",
      planned: fd.get("planned") === "on",
      area: (fd.get("area") as string) ?? "",
      companyId: companyId ? companyId : null,
      responsible: (fd.get("responsible") as string) ?? "",
      notes: (fd.get("notes") as string) ?? "",
    };
    startTransition(async () => {
      const result = id
        ? await updateSafetyInspectionHeaderAction(id, input)
        : await createSafetyInspectionAction(input);
      if (result.ok) {
        setFormError(null);
        router.push(`/inspecoes-seguranca/${result.data.id}`);
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
        <span className="text-text-muted text-sm font-semibold">Categoria *</span>
        <select
          name="category"
          defaultValue={initial?.category ?? "safety"}
          className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <TextField
        label="Data da inspeção"
        name="inspectedAt"
        type="date"
        required
        defaultValue={initial?.inspectedAt}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="planned"
          defaultChecked={initial?.planned ?? false}
        />
        Inspeção planejada
      </label>
      <TextField label="Área / local" name="area" defaultValue={initial?.area} />
      <SelectField
        label="Empresa (opcional)"
        name="companyId"
        options={companies}
        defaultValue={initial?.companyId}
        emptyLabel="— sem empresa —"
      />
      <TextField
        label="Responsável"
        name="responsible"
        defaultValue={initial?.responsible}
      />
      <TextField label="Observações" name="notes" defaultValue={initial?.notes} />

      <FormActions>
        <SubmitButton
          pending={pending}
          label={id ? "Salvar cabeçalho" : "Criar e registrar ocorrências"}
        />
      </FormActions>
    </form>
  );
}
