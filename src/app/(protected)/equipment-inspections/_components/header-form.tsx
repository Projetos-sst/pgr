"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  createEquipmentInspectionAction,
  updateEquipmentInspectionHeaderAction,
} from "@/shared/server/actions/inspections/equipment-inspections";

import {
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

type Option = { value: string; label: string };

export type EquipmentHeaderInitial = {
  equipmentCatalogId: string | null;
  planId: string | null;
  inspectedAt: string;
  responsible: string | null;
  notes: string | null;
};

export function HeaderForm({
  id,
  equipment,
  plans,
  initial,
}: {
  id?: string;
  equipment: Option[];
  plans: Option[];
  initial?: EquipmentHeaderInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      equipmentCatalogId: (fd.get("equipmentCatalogId") as string) ?? "",
      planId: (fd.get("planId") as string) ?? "",
      inspectedAt: (fd.get("inspectedAt") as string) ?? "",
      responsible: (fd.get("responsible") as string) ?? "",
      notes: (fd.get("notes") as string) ?? "",
    };
    startTransition(async () => {
      const result = id
        ? await updateEquipmentInspectionHeaderAction(id, input)
        : await createEquipmentInspectionAction(input);
      if (result.ok) {
        setFormError(null);
        router.push(`/equipment-inspections/${result.data.id}`);
        router.refresh();
      } else {
        setFormError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4">
      <FormError message={formError} />
      <SelectField
        label="Equipamento / máquina"
        name="equipmentCatalogId"
        required
        options={equipment}
        defaultValue={initial?.equipmentCatalogId}
        emptyLabel="— selecione o equipamento —"
      />
      <SelectField
        label="Plano (checklist de equipamento)"
        name="planId"
        required
        options={plans}
        defaultValue={initial?.planId}
        emptyLabel="— selecione o plano —"
      />
      <TextField
        label="Data da inspeção"
        name="inspectedAt"
        type="date"
        required
        defaultValue={initial?.inspectedAt}
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
          label={id ? "Salvar cabeçalho" : "Criar e ir ao checklist"}
        />
      </FormActions>
    </form>
  );
}
