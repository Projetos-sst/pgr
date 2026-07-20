"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  createVehicularInspectionAction,
  updateVehicularInspectionHeaderAction,
} from "@/shared/server/actions/inspections/vehicular-inspections";

import {
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

type Option = { value: string; label: string };

export type HeaderFormInitial = {
  vehicleId: string | null;
  planId: string | null;
  inspectedAt: string;
  responsible: string | null;
  driverName: string | null;
  driverLicense: string | null;
  currentKm: number | null;
  route: string | null;
  notes: string | null;
};

export function HeaderForm({
  id,
  vehicles,
  plans,
  initial,
}: {
  id?: string;
  vehicles: Option[];
  plans: Option[];
  initial?: HeaderFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const currentKmRaw = (fd.get("currentKm") as string)?.trim();
    const input = {
      vehicleId: (fd.get("vehicleId") as string) ?? "",
      planId: (fd.get("planId") as string) ?? "",
      inspectedAt: (fd.get("inspectedAt") as string) ?? "",
      responsible: (fd.get("responsible") as string) ?? "",
      driverName: (fd.get("driverName") as string) ?? "",
      driverLicense: (fd.get("driverLicense") as string) ?? "",
      currentKm: currentKmRaw ? Number(currentKmRaw) : undefined,
      route: (fd.get("route") as string) ?? "",
      notes: (fd.get("notes") as string) ?? "",
    };
    startTransition(async () => {
      const result = id
        ? await updateVehicularInspectionHeaderAction(id, input)
        : await createVehicularInspectionAction(input);
      if (result.ok) {
        setFormError(null);
        // Passo 2: segue direto para o checklist da inspeção.
        router.push(`/vehicular-inspections/${result.data.id}`);
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
        label="Veículo"
        name="vehicleId"
        required
        options={vehicles}
        defaultValue={initial?.vehicleId}
        emptyLabel="— selecione o veículo —"
      />
      <SelectField
        label="Plano (checklist veicular)"
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
      <TextField label="Motorista" name="driverName" defaultValue={initial?.driverName} />
      <TextField
        label="CNH do motorista"
        name="driverLicense"
        defaultValue={initial?.driverLicense}
      />
      <TextField
        label="Quilometragem atual"
        name="currentKm"
        type="number"
        defaultValue={initial?.currentKm != null ? String(initial.currentKm) : ""}
      />
      <TextField label="Rota / trajeto" name="route" defaultValue={initial?.route} />
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
