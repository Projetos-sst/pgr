"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ChangeEvent } from "react";

import {
  INSPECTION_FREQUENCY_LABELS,
  VEHICLE_TYPE_LABELS,
} from "@/shared/domains/inspections/vehicles";
import {
  createVehicleAction,
  updateVehicleAction,
  uploadVehiclePhotoAction,
} from "@/shared/server/actions/inspections/vehicles";

import {
  CancelLink,
  FormActions,
  FormError,
  FieldError,
  FormSection,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

type Option = { value: string; label: string };

const TYPE_OPTIONS = Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const FREQUENCY_OPTIONS = Object.entries(INSPECTION_FREQUENCY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export type VehicleFormInitial = {
  plate: string;
  renavam: string | null;
  brand: string | null;
  model: string | null;
  type: string | null;
  year: number | null;
  color: string | null;
  owner: string | null;
  companyId: string | null;
  workUnitId: string | null;
  inspectionPlanId: string | null;
  inspectionFrequency: string | null;
  initialKm: number;
  notes: string | null;
  photoPath: string | null;
};

export function VehicleForm({
  id,
  companies,
  workUnits,
  inspectionPlans,
  initial,
  photoUrl = null,
}: {
  id?: string;
  companies: Option[];
  workUnits: Option[];
  inspectionPlans: Option[];
  initial?: VehicleFormInitial;
  photoUrl?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState(initial?.photoPath ?? "");
  const [photoPreview, setPhotoPreview] = useState(photoUrl);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoUploading(true);
    setPhotoError(null);
    const data = new FormData();
    data.set("file", file);
    try {
      const result = await uploadVehiclePhotoAction(data);
      if (result.ok) {
        setPhotoPath(result.data.path);
        setPhotoPreview(result.data.url);
      } else {
        setPhotoError(result.error.message);
      }
    } catch {
      setPhotoError("Falha ao enviar a foto. Tente novamente.");
    } finally {
      setPhotoUploading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (photoUploading || pending) return;
    const fd = new FormData(event.currentTarget);
    const str = (k: string) => (fd.get(k) as string)?.trim() || undefined;
    const input = {
      plate: (fd.get("plate") as string) ?? "",
      renavam: str("renavam"),
      brand: str("brand"),
      model: str("model"),
      type: str("type"),
      year: str("year"),
      color: str("color"),
      owner: str("owner"),
      companyId: str("companyId") ?? null,
      workUnitId: str("workUnitId") ?? null,
      inspectionPlanId: str("inspectionPlanId") ?? null,
      inspectionFrequency: str("inspectionFrequency"),
      initialKm: (fd.get("initialKm") as string) ?? "0",
      notes: str("notes"),
      photoPath,
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
        <TextField
          label="Placa"
          name="plate"
          required
          isMono
          placeholder="AAA-0A00"
          defaultValue={initial?.plate}
          error={errors.plate}
        />
        <TextField
          label="Renavam"
          name="renavam"
          isMono
          placeholder="00000000000"
          defaultValue={initial?.renavam}
          error={errors.renavam}
        />
        <TextField
          label="Modelo"
          name="model"
          placeholder="Ex.: Mercedes Actros 2651"
          defaultValue={initial?.model}
          error={errors.model}
        />
        <TextField
          label="Marca"
          name="brand"
          placeholder="Ex.: Mercedes-Benz"
          defaultValue={initial?.brand}
          error={errors.brand}
        />
        <SelectField
          label="Tipo"
          name="type"
          defaultValue={initial?.type ?? ""}
          options={TYPE_OPTIONS}
          emptyLabel="— selecione —"
          error={errors.type}
        />
        <TextField
          label="Ano"
          name="year"
          type="number"
          placeholder="Ex.: 2022"
          defaultValue={initial?.year != null ? String(initial.year) : undefined}
          error={errors.year}
        />
        <TextField
          label="Cor"
          name="color"
          placeholder="Ex.: Branco"
          defaultValue={initial?.color}
          error={errors.color}
        />
      </FormSection>

      <FormSection title="Vínculo & inspeção">
        <SelectField
          label="Empresa"
          name="companyId"
          defaultValue={initial?.companyId ?? ""}
          options={companies}
          emptyLabel="— sem empresa —"
          error={errors.companyId}
        />
        <SelectField
          label="Unidade / Obra"
          name="workUnitId"
          defaultValue={initial?.workUnitId ?? ""}
          options={workUnits}
          emptyLabel="— sem unidade —"
          error={errors.workUnitId}
        />
        <SelectField
          label="Plano de inspeção"
          name="inspectionPlanId"
          defaultValue={initial?.inspectionPlanId ?? ""}
          options={inspectionPlans}
          emptyLabel="— sem plano —"
          error={errors.inspectionPlanId}
        />
        <SelectField
          label="Frequência"
          name="inspectionFrequency"
          defaultValue={initial?.inspectionFrequency ?? ""}
          options={FREQUENCY_OPTIONS}
          emptyLabel="— sem frequência —"
          error={errors.inspectionFrequency}
        />
      </FormSection>

      <FormSection title="Dados operacionais">
        <div className="sm:col-span-full">
          <label
            htmlFor="vehicle-photo"
            className="text-text-muted mb-1.5 block text-xs font-semibold"
          >
            Foto do veículo
          </label>
          {photoPreview ? (
            <img
              src={photoPreview}
              alt="Foto do veículo"
              className="glass-panel rounded-card mb-3 h-40 w-full max-w-sm object-contain"
            />
          ) : null}
          <input
            id="vehicle-photo"
            type="file"
            accept="image/png,image/jpeg"
            onChange={onPhotoChange}
            disabled={photoUploading || pending}
            className="glass-input rounded-card max-w-full p-3 text-sm"
          />
          <p className="text-text-subtle mt-1 text-xs">
            PNG ou JPG, até 5 MB. Salve o veículo para confirmar a alteração da foto.
          </p>
          {photoUploading ? (
            <p role="status" className="text-text-muted mt-2 text-sm">
              Enviando foto…
            </p>
          ) : null}
          {photoPath ? (
            <button
              type="button"
              disabled={photoUploading || pending}
              onClick={() => {
                setPhotoPath("");
                setPhotoPreview(null);
                setPhotoError(null);
              }}
              className="text-primary mt-2 text-sm font-semibold disabled:opacity-50"
            >
              Remover foto
            </button>
          ) : null}
          <FieldError message={photoError ?? errors.photoPath} />
        </div>
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
        <TextField
          label="Observações"
          name="notes"
          isFullWidth
          placeholder="Anotações internas sobre o veículo"
          defaultValue={initial?.notes}
          error={errors.notes}
        />
      </FormSection>

      <FormActions>
        <CancelLink href="/vehicles" />
        <SubmitButton
          pending={pending || photoUploading}
          label={id ? "Salvar veículo" : "Criar veículo"}
        />
      </FormActions>
    </form>
  );
}
