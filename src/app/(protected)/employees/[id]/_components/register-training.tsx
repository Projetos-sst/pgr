"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import { createTrainingRecordAction } from "@/shared/server/actions/pgr/training-records";
import {
  computeValidUntil,
  trainingPeriodicityLabel,
  type TrainingCatalogOption,
} from "@/shared/domains/pgr/trainings";
import { todayInSaoPaulo } from "@/shared/dates";

import {
  FieldError,
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../../_ui/form";

function formatIsoDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("pt-BR");
}

/**
 * Registro de realização (US2). A validade exibida aqui é só FEEDBACK visual
 * (mesma função pura D1); o valor gravado é sempre o calculado no servidor.
 */
export function RegisterTraining({
  employeeId,
  options,
}: {
  employeeId: string;
  options: TrainingCatalogOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [trainingId, setTrainingId] = useState("");
  const [completedAt, setCompletedAt] = useState(todayInSaoPaulo());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => options.find((option) => option.id === trainingId) ?? null,
    [options, trainingId],
  );
  const predictedValidity = useMemo(() => {
    if (!selected || !/^\d{4}-\d{2}-\d{2}$/.test(completedAt)) return null;
    return computeValidUntil(completedAt, selected.periodicity);
  }, [selected, completedAt]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createTrainingRecordAction({
        employeeId,
        trainingId,
        completedAt,
        certificatePath: String(fd.get("certificatePath") ?? ""),
      });
      if (result.ok) {
        setOpen(false);
        setTrainingId("");
        setCompletedAt(todayInSaoPaulo());
        setErrors({});
        setFormError(null);
        router.refresh();
        return;
      }
      setErrors(result.error.fields ?? {});
      setFormError(result.error.fields ? null : result.error.message);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary rounded-pill px-4 py-2 text-sm font-semibold transition-colors"
      >
        Registrar treinamento
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card flex w-full max-w-xl flex-col gap-4 p-4"
    >
      <FormError message={formError} />
      <SelectField
        label="Treinamento"
        name="trainingId"
        required
        value={trainingId}
        onChange={setTrainingId}
        options={options.map((option) => ({
          value: option.id,
          label: `${option.name} (${trainingPeriodicityLabel(option.periodicity)})`,
        }))}
        error={errors.trainingId}
        emptyLabel={
          options.length === 0 ? "— cadastre um treinamento no catálogo —" : undefined
        }
      />
      <TextField
        label="Data de realização"
        name="completedAt"
        type="date"
        required
        value={completedAt}
        onChange={setCompletedAt}
        error={errors.completedAt}
      />
      <TextField
        label="Certificado (caminho/referência, opcional)"
        name="certificatePath"
        error={errors.certificatePath}
      />
      {selected ? (
        <p className="text-text-muted text-sm">
          Validade prevista:{" "}
          <span className="font-medium">
            {predictedValidity ? formatIsoDate(predictedValidity) : "não expira (única)"}
          </span>{" "}
          — calculada pela periodicidade; o valor gravado é o do servidor.
        </p>
      ) : null}
      <FieldError message={errors._} />
      <FormActions>
        <SubmitButton pending={pending} label="Registrar" />
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
      </FormActions>
    </form>
  );
}
