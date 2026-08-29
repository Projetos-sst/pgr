"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import {
  createRiskAssessmentAction,
  updateRiskAssessmentAction,
} from "@/shared/server/actions/pgr/risk-assessments";
import { assessmentCriterionSchema } from "@/shared/domains/pgr/risks";
import {
  computeRiskLevel,
  classify,
  riskClassificationLabel,
  assessmentCriterionLabel,
  uncertaintyDegreeLabel,
  probabilityLabel,
  severityLabel,
  type RiskAssessmentInput,
  type ClassificationBand,
} from "@/shared/domains/pgr/risk-assessment";
import { riskClassificationGuidance } from "@/shared/domains/pgr/methodology";
import type { ActionError } from "@/shared/server/result";

import { FieldError, FormActions, FormError, SubmitButton } from "../../../../_ui/form";

const CRITERION_OPTIONS = assessmentCriterionSchema.options.map((v) => ({
  value: v,
  label: assessmentCriterionLabel(v),
}));
const PROBABILITY_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  label: `${n} — ${probabilityLabel(n)}`,
}));
const SEVERITY_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  label: `${n} — ${severityLabel(n)}`,
}));
const UNCERTAINTY_OPTIONS = [0, 1, 2].map((n) => ({
  value: String(n),
  label: `${n} — ${uncertaintyDegreeLabel(n)}`,
}));

const inputClass = "glass-input text-text rounded-card px-3 py-2 text-sm outline-none";

export type AssessmentFormInitial = {
  criterion?: string;
  probability?: number;
  severity?: number;
  uncertaintyDegree?: number;
  toleranceLimit?: string | null;
  assessedAt: string;
};

function Select({
  label,
  name,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-text-muted text-sm font-medium">{label} *</span>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <FieldError message={error} />
    </label>
  );
}

export function AssessmentForm({
  riskId,
  assessmentId,
  bands,
  configured,
  initial,
}: {
  riskId: string;
  assessmentId?: string;
  bands: ClassificationBand[];
  configured: boolean;
  initial: AssessmentFormInitial;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [criterion, setCriterion] = useState(initial.criterion ?? "qualitative");
  const [probability, setProbability] = useState(String(initial.probability ?? 1));
  const [severity, setSeverity] = useState(String(initial.severity ?? 1));
  const [uncertaintyDegree, setUncertaintyDegree] = useState(
    String(initial.uncertaintyDegree ?? 0),
  );

  const preview = useMemo(() => {
    const p = Number(probability);
    const s = Number(severity);
    if (
      !Number.isInteger(p) ||
      !Number.isInteger(s) ||
      p < 1 ||
      p > 5 ||
      s < 1 ||
      s > 5
    ) {
      return null;
    }
    const riskLevel = computeRiskLevel(p, s);
    return { riskLevel, result: classify(riskLevel, bands) };
  }, [probability, severity, bands]);

  function applyError(error: ActionError) {
    setErrors(error.fields ?? {});
    setFormError(error.fields ? null : error.message);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input: RiskAssessmentInput = {
      criterion: criterion as RiskAssessmentInput["criterion"],
      probability,
      severity,
      uncertaintyDegree,
      toleranceLimit: String(fd.get("toleranceLimit") ?? ""),
      assessedAt: String(fd.get("assessedAt") ?? ""),
    };
    startTransition(async () => {
      const result = assessmentId
        ? await updateRiskAssessmentAction(riskId, assessmentId, input)
        : await createRiskAssessmentAction(riskId, input);
      if (result.ok) {
        router.push(`/risks/${riskId}/assessments`);
        router.refresh();
        return;
      }
      applyError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <FormError message={formError} />

      {!configured ? (
        <p className="rounded-card border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          A organização ainda não configurou uma metodologia de risco. A classificação usa
          a <strong>metodologia padrão</strong> até que uma seja definida.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Critério"
          name="criterion"
          value={criterion}
          onChange={setCriterion}
          options={CRITERION_OPTIONS}
          error={errors.criterion}
        />
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-medium">Data da avaliação *</span>
          <input
            type="date"
            name="assessedAt"
            defaultValue={initial.assessedAt}
            className={inputClass}
          />
          <FieldError message={errors.assessedAt} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label="Probabilidade"
          name="probability"
          value={probability}
          onChange={setProbability}
          options={PROBABILITY_OPTIONS}
          error={errors.probability}
        />
        <Select
          label="Severidade"
          name="severity"
          value={severity}
          onChange={setSeverity}
          options={SEVERITY_OPTIONS}
          error={errors.severity}
        />
        <Select
          label="Grau de incerteza"
          name="uncertaintyDegree"
          value={uncertaintyDegree}
          onChange={setUncertaintyDegree}
          options={UNCERTAINTY_OPTIONS}
          error={errors.uncertaintyDegree}
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-text-muted text-sm font-medium">Limite de tolerância</span>
        <input
          name="toleranceLimit"
          defaultValue={initial.toleranceLimit ?? ""}
          className={inputClass}
        />
        <FieldError message={errors.toleranceLimit} />
      </label>

      <div className="glass-card grid gap-4 p-4 sm:grid-cols-2">
        <div className="flex flex-col">
          <span className="text-text-subtle text-xs tracking-wide uppercase">
            Nível de risco (calculado)
          </span>
          <span className="text-text text-lg font-semibold">
            {preview ? preview.riskLevel : "—"}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-text-subtle text-xs tracking-wide uppercase">
            Classificação (prevista)
          </span>
          <span className="text-text text-lg font-semibold">
            {preview ? riskClassificationLabel(preview.result) : "—"}
          </span>
          {preview ? (
            <p className="text-text-subtle text-sm">
              {riskClassificationGuidance(preview.result)}
            </p>
          ) : null}
        </div>
      </div>

      <FieldError message={errors._} />
      <FormActions>
        <SubmitButton
          pending={pending}
          label={assessmentId ? "Salvar alterações" : "Criar avaliação"}
        />
      </FormActions>
    </form>
  );
}
