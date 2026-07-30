"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { VEHICLE_TYPE_LABELS } from "@/shared/domains/inspections/vehicles";
import {
  createVehicleAction,
  updateVehicleAction,
} from "@/shared/server/actions/inspections/vehicles";

import {
  CancelLink,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

const TYPE_OPTIONS = Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export type VehicleFormInitial = {
  plate: string;
  brand: string | null;
  model: string | null;
  type: string | null;
  color: string | null;
  owner: string | null;
  initialKm: number;
  notes: string | null;
};

export function VehicleForm({
  id,
  initial,
}: {
  id?: string;
  initial?: VehicleFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      plate: (fd.get("plate") as string) ?? "",
      brand: (fd.get("brand") as string) ?? "",
      model: (fd.get("model") as string) ?? "",
      type: (fd.get("type") as string) ?? "",
      color: (fd.get("color") as string) ?? "",
      owner: (fd.get("owner") as string) ?? "",
      initialKm: (fd.get("initialKm") as string) ?? "0",
      notes: (fd.get("notes") as string) ?? "",
    };
    startTransition(async () => {
      const result = id
        ? await updateVehicleAction(id, input)
        : await createVehicleAction(input);
      if (result.ok) {
        setErrors({});
        setFormError(null);
        router.push("/vehicles");
        router.refresh();
      } else {
        setErrors(result.error.fields ?? {});
        setFormError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FormError message={formError} />

      <FormSection title="Identificação">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <TextField
            label="Placa"
            name="plate"
            required
            isMono
            placeholder="AAA-0A00"
            defaultValue={initial?.plate}
            error={errors.plate}
          />
          <SelectField
            label="Tipo"
            name="type"
            defaultValue={initial?.type ?? ""}
            options={TYPE_OPTIONS}
            error={errors.type}
          />
          <TextField
            label="Marca"
            name="brand"
            placeholder="Ex.: Mercedes-Benz"
            defaultValue={initial?.brand}
            error={errors.brand}
          />
          <TextField
            label="Modelo"
            name="model"
            placeholder="Ex.: Actros 2651"
            defaultValue={initial?.model}
            error={errors.model}
          />
          <TextField
            label="Cor"
            name="color"
            placeholder="Ex.: Branco"
            defaultValue={initial?.color}
            error={errors.color}
          />
        </div>
      </FormSection>

      <FormSection title="Dados operacionais">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <TextField
            label="Proprietário"
            name="owner"
            placeholder="Ex.: Frota própria"
            defaultValue={initial?.owner}
            error={errors.owner}
          />
          <TextField
            label="KM inicial"
            name="initialKm"
            type="number"
            placeholder="0"
            defaultValue={initial ? String(initial.initialKm) : "0"}
            error={errors.initialKm}
          />
          <div className="sm:col-span-2">
            <TextField
              label="Observações"
              name="notes"
              placeholder="Anotações internas sobre o veículo"
              defaultValue={initial?.notes}
              error={errors.notes}
            />
          </div>
        </div>
      </FormSection>

      <FormActions>
        <CancelLink href="/vehicles" />
        <SubmitButton pending={pending} label={id ? "Salvar veículo" : "Criar veículo"} />
      </FormActions>
    </form>
  );
}
