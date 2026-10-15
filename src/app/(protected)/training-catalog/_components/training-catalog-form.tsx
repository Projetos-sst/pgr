"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  createTrainingCatalogAction,
  updateTrainingCatalogAction,
} from "@/shared/server/actions/pgr/training-catalog";
import {
  TRAINING_PERIODICITIES,
  trainingPeriodicityLabel,
  type TrainingCatalog,
  type TrainingCatalogInput,
} from "@/shared/domains/pgr/trainings";

import {
  FieldError,
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

const PERIODICITY_OPTIONS = TRAINING_PERIODICITIES.map((value) => ({
  value,
  label: trainingPeriodicityLabel(value),
}));

export function TrainingCatalogForm({ training }: { training?: TrainingCatalog }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const value = (key: string) => String(fd.get(key) ?? "");
    const input: TrainingCatalogInput = {
      name: value("name"),
      referenceNorm: value("referenceNorm"),
      workloadHours: value("workloadHours"),
      periodicity: value("periodicity") as TrainingCatalogInput["periodicity"],
      isActive: value("isActive") === "true",
      description: value("description"),
    };

    startTransition(async () => {
      const result = training
        ? await updateTrainingCatalogAction(training.id, input)
        : await createTrainingCatalogAction(input);
      if (result.ok) {
        router.push("/training-catalog");
        router.refresh();
        return;
      }
      setErrors(result.error.fields ?? {});
      setFormError(result.error.fields ? null : result.error.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <FormError message={formError} />
      <TextField
        label="Nome"
        name="name"
        required
        defaultValue={training?.name}
        error={errors.name}
      />
      <TextField
        label="Norma de referência"
        name="referenceNorm"
        defaultValue={training?.referenceNorm}
        error={errors.referenceNorm}
      />
      <TextField
        label="Carga horária (horas)"
        name="workloadHours"
        type="number"
        required
        defaultValue={training ? String(training.workloadHours) : ""}
        error={errors.workloadHours}
      />
      <SelectField
        label="Periodicidade"
        name="periodicity"
        required
        defaultValue={training?.periodicity}
        options={PERIODICITY_OPTIONS}
        error={errors.periodicity}
      />
      <SelectField
        label="Status"
        name="isActive"
        defaultValue={training ? String(training.isActive) : "true"}
        options={[
          { value: "true", label: "Vigente" },
          { value: "false", label: "Inativo" },
        ]}
        error={errors.isActive}
      />
      <TextField
        label="Descrição"
        name="description"
        defaultValue={training?.description}
        error={errors.description}
      />
      <FieldError message={errors._} />
      <FormActions>
        <SubmitButton
          pending={pending}
          label={training ? "Salvar alterações" : "Criar treinamento"}
        />
      </FormActions>
    </form>
  );
}
