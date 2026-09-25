"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  createControlMeasureAction,
  updateControlMeasureAction,
} from "@/shared/server/actions/pgr/control-measures";
import {
  controlLevelSchema,
  controlLevelLabel,
  controlMeasureStatusSchema,
  isMeasureMissingRequiredPlanFields,
  isModeratePlusClassification,
  measureStatusLabel,
  type ControlMeasureInput,
} from "@/shared/domains/pgr/control-measure";
import {
  riskClassificationLabel,
  type RiskClassification,
} from "@/shared/domains/pgr/methodology";
import type { ActionError } from "@/shared/server/result";

import { FieldError, FormError } from "../../../../_ui/form";

const CONTROL_LEVEL_OPTIONS = controlLevelSchema.options.map((v) => ({
  value: v,
  label: controlLevelLabel(v),
}));

const MEASURE_STATUS_OPTIONS = controlMeasureStatusSchema.options.map((v) => ({
  value: v,
  label: measureStatusLabel(v),
}));

const inputClass = "glass-input text-text rounded-card px-3 py-2 text-sm outline-none";

export type ControlMeasureFormInitial = {
  controlLevel?: string;
  applicable?: boolean;
  status?: string | null;
  justification?: string | null;
  monitoring?: string | null;
  actionWhat?: string | null;
  actionHow?: string | null;
  actionTracking?: string | null;
  actionMeasurement?: string | null;
  actionResponsible?: string | null;
  actionDeadline?: string | null;
};

function Textarea({
  label,
  name,
  defaultValue,
  required,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-text-muted text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={2}
        className={inputClass}
      />
      <FieldError message={error} />
    </label>
  );
}

export function ControlMeasureForm({
  riskId,
  measureId,
  initial,
  employees,
  lockLevel = false,
  riskClassification = null,
}: {
  riskId: string;
  measureId?: string;
  initial: ControlMeasureFormInitial;
  employees: { id: string; fullName: string }[];
  lockLevel?: boolean;
  /** Classificação vigente do risco (`null` = sem avaliação) — define se prazo/responsável são exigidos. */
  riskClassification?: RiskClassification | null;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [controlLevel, setControlLevel] = useState(
    initial.controlLevel ?? CONTROL_LEVEL_OPTIONS[0].value,
  );
  const [applicable, setApplicable] = useState(initial.applicable ?? false);
  const [status, setStatus] = useState(initial.status ?? "");
  // #42: mesma regra do repositório, avaliada antes do submit. O servidor continua a autoridade.
  const requiresOwnership =
    applicable && isModeratePlusClassification(riskClassification);

  function applyError(error: ActionError) {
    if (error.code === "DUPLICATE") {
      setErrors({});
      setFormError("Este nível NR-01 já possui uma medida para este risco.");
      return;
    }
    setErrors(error.fields ?? {});
    setFormError(error.fields ? null : error.message);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const str = (k: string) => String(fd.get(k) ?? "");
    const input: ControlMeasureInput = {
      controlLevel: controlLevel as ControlMeasureInput["controlLevel"],
      applicable,
      status: status === "" ? undefined : (status as ControlMeasureInput["status"]),
      justification: str("justification"),
      monitoring: str("monitoring"),
      actionWhat: str("actionWhat"),
      actionHow: str("actionHow"),
      actionTracking: str("actionTracking"),
      actionMeasurement: str("actionMeasurement"),
      actionResponsible: str("actionResponsible"),
      actionDeadline: str("actionDeadline"),
    };
    const ownership = {
      applicable,
      actionResponsible: str("actionResponsible"),
      actionDeadline: str("actionDeadline"),
    };
    if (isMeasureMissingRequiredPlanFields(ownership, riskClassification)) {
      setFormError(null);
      setErrors({
        ...(ownership.actionResponsible
          ? {}
          : {
              actionResponsible:
                "Informe o responsável: exigido para risco moderado ou superior.",
            }),
        ...(ownership.actionDeadline
          ? {}
          : {
              actionDeadline: "Informe o prazo: exigido para risco moderado ou superior.",
            }),
      });
      return;
    }
    startTransition(async () => {
      const result = measureId
        ? await updateControlMeasureAction(riskId, measureId, input)
        : await createControlMeasureAction(riskId, input);
      if (result.ok) {
        router.push(`/risks/${riskId}/control-measures`);
        router.refresh();
        return;
      }
      applyError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <FormError message={formError} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-medium">Nível NR-01 *</span>
          <select
            value={controlLevel}
            onChange={(e) => setControlLevel(e.target.value)}
            disabled={lockLevel}
            className={inputClass}
          >
            {CONTROL_LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {lockLevel ? (
            <span className="text-text-subtle text-xs">
              O nível não pode ser alterado; crie/exclua medidas para mudar de nível.
            </span>
          ) : null}
          <FieldError message={errors.controlLevel} />
        </label>

        <label className="flex flex-row items-center gap-2 pt-6">
          <input
            type="checkbox"
            checked={applicable}
            onChange={(e) => setApplicable(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-text-muted text-sm font-medium">
            Medida aplicável a este risco
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-medium">Status da medida</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            <option value="">— Automático pelo nível do risco —</option>
            {MEASURE_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-text-subtle text-xs">
            Deixe em automático para aplicar a regra padrão (trivial/tolerável → Manter;
            moderado ou superior → Introduzida).
          </span>
          <FieldError message={errors.status} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Textarea
          label="Ação a implementar (o quê)"
          name="actionWhat"
          defaultValue={initial.actionWhat}
          required={applicable}
          error={errors.actionWhat}
        />
        <Textarea
          label="Como será implementada"
          name="actionHow"
          defaultValue={initial.actionHow}
          required={applicable}
          error={errors.actionHow}
        />
        <Textarea
          label="Formas de acompanhamento"
          name="actionTracking"
          defaultValue={initial.actionTracking}
          error={errors.actionTracking}
        />
        <Textarea
          label="Aferição de resultados"
          name="actionMeasurement"
          defaultValue={initial.actionMeasurement}
          error={errors.actionMeasurement}
        />
      </div>

      {requiresOwnership && riskClassification ? (
        <p
          role="note"
          className="rounded-card border border-amber-300/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-800"
        >
          Risco {riskClassificationLabel(riskClassification).toLowerCase()}: responsável e
          prazo são obrigatórios para medida aplicável.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-medium">
            Responsável pela ação
            {requiresOwnership ? " *" : ""}
          </span>
          <input
            name="actionResponsible"
            defaultValue={initial.actionResponsible ?? ""}
            list="control-measure-employees"
            placeholder="Nome do responsável (ou selecione um funcionário)"
            className={inputClass}
          />
          <datalist id="control-measure-employees">
            {employees.map((e) => (
              <option key={e.id} value={e.fullName} />
            ))}
          </datalist>
          <FieldError message={errors.actionResponsible} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-medium">
            Prazo para execução
            {requiresOwnership ? " *" : ""}
          </span>
          <input
            type="date"
            name="actionDeadline"
            defaultValue={initial.actionDeadline ?? ""}
            className={inputClass}
          />
          <FieldError message={errors.actionDeadline} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Textarea
          label="Justificativa (quando não aplicável)"
          name="justification"
          defaultValue={initial.justification}
          error={errors.justification}
        />
        <Textarea
          label="Monitoramento"
          name="monitoring"
          defaultValue={initial.monitoring}
          error={errors.monitoring}
        />
      </div>

      <FieldError message={errors._} />
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {pending ? "Salvando…" : measureId ? "Salvar alterações" : "Criar medida"}
        </button>
      </div>
    </form>
  );
}
