"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  createPsychosocialRiskFactorAction,
  updatePsychosocialRiskFactorAction,
} from "@/shared/server/actions/psychosocial/risk-factors";
import {
  PSYCHOSOCIAL_FACTOR_STATUSES,
  PSYCHOSOCIAL_RISK_LEVELS,
  psychosocialFactorStatusLabel,
  psychosocialRiskLevelLabel,
  type PsychosocialRiskFactor,
  type PsychosocialRiskFactorInput,
} from "@/shared/domains/psychosocial/risk-factors";

// Opção de GES para o select — tipo local (o repositório server-only não pode
// ser importado no bundle do cliente).
type GesOption = { id: string; name: string };

import {
  FieldError,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../../../_ui/form";
import { CancelLink } from "../../../_ui/form";

const LEVEL_OPTIONS = PSYCHOSOCIAL_RISK_LEVELS.map((value) => ({
  value,
  label: psychosocialRiskLevelLabel(value),
}));

const STATUS_OPTIONS = PSYCHOSOCIAL_FACTOR_STATUSES.map((value) => ({
  value,
  label: psychosocialFactorStatusLabel(value),
}));

export function RiskFactorForm({
  factor,
  gesOptions,
}: {
  factor?: PsychosocialRiskFactor;
  gesOptions: GesOption[];
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const gesSelectOptions = gesOptions.map((g) => ({ value: g.id, label: g.name }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const value = (key: string) => String(fd.get(key) ?? "");
    const input: PsychosocialRiskFactorInput = {
      name: value("name"),
      gesId: value("gesId"),
      level: value("level") as PsychosocialRiskFactorInput["level"],
      assessmentMethod: value("assessmentMethod"),
      status: value("status") as PsychosocialRiskFactorInput["status"],
      description: value("description"),
    };

    startTransition(async () => {
      const result = factor
        ? await updatePsychosocialRiskFactorAction(factor.id, input)
        : await createPsychosocialRiskFactorAction(input);
      if (result.ok) {
        router.push("/psychosocial/risk-factors");
        router.refresh();
        return;
      }
      setErrors(result.error.fields ?? {});
      setFormError(result.error.fields ? null : result.error.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError message={formError} />
      <FormSection title="Fator de Risco Psicossocial">
        <TextField
          label="Fator de risco"
          name="name"
          required
          defaultValue={factor?.name}
          error={errors.name}
          isFullWidth
        />
        <SelectField
          label="GES"
          name="gesId"
          required
          defaultValue={factor?.gesId}
          options={gesSelectOptions}
          emptyLabel="— selecione o GES —"
          error={errors.gesId}
        />
        <SelectField
          label="Nível"
          name="level"
          required
          defaultValue={factor?.level}
          options={LEVEL_OPTIONS}
          error={errors.level}
        />
        <TextField
          label="Avaliação (método)"
          name="assessmentMethod"
          placeholder="Ex.: Questionário COPSOQ, Escuta ativa, Entrevista"
          defaultValue={factor?.assessmentMethod}
          error={errors.assessmentMethod}
        />
        <SelectField
          label="Situação"
          name="status"
          defaultValue={factor?.status ?? "monitored"}
          options={STATUS_OPTIONS}
          error={errors.status}
        />
        <TextAreaField
          label="Descrição"
          name="description"
          defaultValue={factor?.description}
          error={errors.description}
        />
      </FormSection>
      <FieldError message={errors._} />
      <FormActions>
        <CancelLink href="/psychosocial/risk-factors" />
        <SubmitButton
          pending={pending}
          label={factor ? "Salvar alterações" : "Criar fator"}
        />
      </FormActions>
    </form>
  );
}
