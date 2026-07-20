"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  WORK_PERMIT_STATUS_LABELS,
  WORK_PERMIT_TYPE_LABELS,
  type WorkPermitStatusKey,
  type WorkPermitTypeKey,
} from "@/shared/domains/work-permits/work-permits";
import {
  createWorkPermitAction,
  updateWorkPermitAction,
} from "@/shared/server/actions/work-permits/work-permits";

import {
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

type Option = { value: string; label: string };

const TYPE_OPTIONS = Object.entries(WORK_PERMIT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const STATUS_OPTIONS = Object.entries(WORK_PERMIT_STATUS_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

export type PermitFormInitial = {
  number: string;
  type: string;
  status: string;
  companyId: string | null;
  area: string | null;
  description: string;
  validFrom: string;
  validUntil: string;
  requestedBy: string | null;
  approvedBy: string | null;
  precautions: string | null;
  notes: string | null;
};

export function PermitForm({
  id,
  companies,
  initial,
}: {
  id?: string;
  companies: Option[];
  initial?: PermitFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const companyId = (fd.get("companyId") as string)?.trim();
    const input = {
      number: (fd.get("number") as string) ?? "",
      type: (fd.get("type") as WorkPermitTypeKey) ?? "hot_work",
      status: (fd.get("status") as WorkPermitStatusKey) ?? "draft",
      companyId: companyId ? companyId : null,
      area: (fd.get("area") as string) ?? "",
      description: (fd.get("description") as string) ?? "",
      validFrom: (fd.get("validFrom") as string) ?? "",
      validUntil: (fd.get("validUntil") as string) ?? "",
      requestedBy: (fd.get("requestedBy") as string) ?? "",
      approvedBy: (fd.get("approvedBy") as string) ?? "",
      precautions: (fd.get("precautions") as string) ?? "",
      notes: (fd.get("notes") as string) ?? "",
    };
    startTransition(async () => {
      const result = id
        ? await updateWorkPermitAction(id, input)
        : await createWorkPermitAction(input);
      if (result.ok) {
        setFormError(null);
        router.push("/work-permits");
        router.refresh();
      } else {
        setFormError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4">
      <FormError message={formError} />
      <TextField
        label="Número da PT"
        name="number"
        required
        defaultValue={initial?.number}
      />
      <label className="flex flex-col gap-1">
        <span className="text-text-muted text-sm font-semibold">Tipo de trabalho *</span>
        <select
          name="type"
          defaultValue={initial?.type ?? "hot_work"}
          className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-text-muted text-sm font-semibold">Status *</span>
        <select
          name="status"
          defaultValue={initial?.status ?? "draft"}
          className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <SelectField
        label="Empresa (opcional)"
        name="companyId"
        options={companies}
        defaultValue={initial?.companyId}
        emptyLabel="— sem empresa —"
      />
      <TextField label="Área / local" name="area" defaultValue={initial?.area} />
      <TextField
        label="Descrição do trabalho"
        name="description"
        required
        defaultValue={initial?.description}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Válida de"
          name="validFrom"
          type="date"
          required
          defaultValue={initial?.validFrom}
        />
        <TextField
          label="Válida até"
          name="validUntil"
          type="date"
          required
          defaultValue={initial?.validUntil}
        />
      </div>
      <TextField
        label="Solicitante"
        name="requestedBy"
        defaultValue={initial?.requestedBy}
      />
      <TextField label="Aprovador" name="approvedBy" defaultValue={initial?.approvedBy} />
      <TextField
        label="Precauções / medidas de controle"
        name="precautions"
        defaultValue={initial?.precautions}
      />
      <TextField label="Observações" name="notes" defaultValue={initial?.notes} />

      <FormActions>
        <SubmitButton pending={pending} label={id ? "Salvar" : "Criar PT"} />
      </FormActions>
    </form>
  );
}
