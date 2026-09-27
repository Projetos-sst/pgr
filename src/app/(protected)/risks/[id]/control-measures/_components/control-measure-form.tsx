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

import {
  CancelLink,
  FieldError,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../../../../_ui/form";

const CONTROL_LEVEL_OPTIONS = controlLevelSchema.options.map((v) => ({
  value: v,
  label: controlLevelLabel(v),
}));

const MEASURE_STATUS_OPTIONS = controlMeasureStatusSchema.options.map((v) => ({
  value: v,
  label: measureStatusLabel(v),
}));

export type ControlMeasureFormInitial = {
  controlLevel?: string;
  applicable?: boolean;
  status?: string | null;
  justification?: string | null;
  monitoring?: string | null;
  actionWhat?: string | null;
  actionWhy?: string | null;
  actionHow?: string | null;
  actionTracking?: string | null;
  actionMeasurement?: string | null;
  actionResponsible?: string | null;
  actionDeadline?: string | null;
  actionCost?: string | null;
};

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
      actionWhy: str("actionWhy"),
      actionHow: str("actionHow"),
      actionTracking: str("actionTracking"),
      actionMeasurement: str("actionMeasurement"),
      actionResponsible: str("actionResponsible"),
      actionDeadline: str("actionDeadline"),
      actionCost: str("actionCost"),
    };
    const ownership = {
      applicable,
      actionResponsible: str("actionResponsible"),
      actionDeadline: str("actionDeadline"),
      actionCost: str("actionCost"),
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
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-[22px]">
      <FormError message={formError} />

      <FormSection title="Medida de controle (NR-01)">
        <SelectField
          label="Nível NR-01"
          name="controlLevel"
          required
          value={controlLevel}
          onChange={setControlLevel}
          options={CONTROL_LEVEL_OPTIONS}
          disabled={lockLevel}
          error={errors.controlLevel}
        />
        <SelectField
          label="Status da medida"
          name="status"
          value={status}
          onChange={setStatus}
          options={MEASURE_STATUS_OPTIONS}
          emptyLabel="— Automático pelo nível do risco —"
          error={errors.status}
        />
        <label className="flex items-center gap-2 sm:col-span-full">
          <input
            type="checkbox"
            checked={applicable}
            onChange={(e) => setApplicable(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-text-muted text-[13px] font-semibold">
            Medida aplicável a este risco
          </span>
        </label>
        <p className="text-text-subtle text-xs sm:col-span-full">
          {lockLevel
            ? "O nível não pode ser alterado; crie/exclua medidas para mudar de nível. "
            : ""}
          Status em automático aplica a regra padrão (trivial/tolerável → Manter; moderado
          ou superior → Introduzida).
        </p>
      </FormSection>

      <FormSection title="Plano de ação 5W2H">
        <TextAreaField
          label="Ação a implementar (o quê)"
          name="actionWhat"
          defaultValue={initial.actionWhat}
          required={applicable}
          rows={2}
          error={errors.actionWhat}
          isFullWidth={false}
        />
        <TextAreaField
          label="Por que a medida é necessária"
          name="actionWhy"
          defaultValue={initial.actionWhy}
          rows={2}
          error={errors.actionWhy}
          isFullWidth={false}
        />
        <TextAreaField
          label="Como será implementada"
          name="actionHow"
          defaultValue={initial.actionHow}
          required={applicable}
          rows={2}
          error={errors.actionHow}
          isFullWidth={false}
        />
        <TextAreaField
          label="Formas de acompanhamento"
          name="actionTracking"
          defaultValue={initial.actionTracking}
          rows={2}
          error={errors.actionTracking}
          isFullWidth={false}
        />
        <TextAreaField
          label="Aferição de resultados"
          name="actionMeasurement"
          defaultValue={initial.actionMeasurement}
          rows={2}
          error={errors.actionMeasurement}
          isFullWidth={false}
        />
        <TextAreaField
          label="Monitoramento"
          name="monitoring"
          defaultValue={initial.monitoring}
          rows={2}
          error={errors.monitoring}
          isFullWidth={false}
        />

        {requiresOwnership && riskClassification ? (
          <p
            role="note"
            className="rounded-field border border-amber-300/60 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 sm:col-span-full"
          >
            Risco {riskClassificationLabel(riskClassification).toLowerCase()}: responsável
            e prazo são obrigatórios para medida aplicável.
          </p>
        ) : null}

        <label className="block">
          <span className="text-text-muted mb-1.5 block text-xs font-semibold">
            Responsável pela ação
            {requiresOwnership ? <span className="text-danger"> *</span> : null}
          </span>
          <input
            name="actionResponsible"
            defaultValue={initial.actionResponsible ?? ""}
            list="control-measure-employees"
            placeholder="Nome do responsável (ou selecione um funcionário)"
            className="glass-input text-text placeholder:text-text-subtle rounded-field h-[46px] w-full px-3.5 text-[13px] outline-none"
          />
          <datalist id="control-measure-employees">
            {employees.map((e) => (
              <option key={e.id} value={e.fullName} />
            ))}
          </datalist>
          <FieldError message={errors.actionResponsible} />
        </label>
        <label className="block">
          <span className="text-text-muted mb-1.5 block text-xs font-semibold">
            Prazo para execução
            {requiresOwnership ? <span className="text-danger"> *</span> : null}
          </span>
          <input
            type="date"
            name="actionDeadline"
            defaultValue={initial.actionDeadline ?? ""}
            className="glass-input text-text rounded-field h-[46px] w-full px-3.5 text-[13px] outline-none"
          />
          <FieldError message={errors.actionDeadline} />
        </label>
        <TextField
          label="Custo estimado (R$)"
          name="actionCost"
          defaultValue={initial.actionCost ?? ""}
          placeholder="Ex.: 1500.00"
          isMono
          error={errors.actionCost}
        />
        <p className="text-text-subtle text-xs sm:col-span-full">
          Motivo e custo completam o 5W2H do PGR (&ldquo;por quê&rdquo; e
          &ldquo;quanto&rdquo;). Em branco, o documento imprime &ldquo;não
          informado&rdquo; — nada é preenchido pelo sistema.
        </p>
      </FormSection>

      <FormSection title="Quando não aplicável">
        <TextAreaField
          label="Justificativa"
          name="justification"
          defaultValue={initial.justification}
          rows={2}
          error={errors.justification}
        />
      </FormSection>

      <FieldError message={errors._} />
      <FormActions>
        <CancelLink href={`/risks/${riskId}/control-measures`} />
        <SubmitButton
          pending={pending}
          label={measureId ? "Salvar alterações" : "Criar medida"}
        />
      </FormActions>
    </form>
  );
}
