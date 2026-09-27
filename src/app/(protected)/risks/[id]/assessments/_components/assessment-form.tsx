"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import {
  createRiskAssessmentAction,
  updateRiskAssessmentAction,
} from "@/shared/server/actions/pgr/risk-assessments";
import {
  assessmentCriterionSchema,
  measurementUnitSchema,
  measurementUnitLabel,
} from "@/shared/domains/pgr/risks";
import {
  NR09_CONCLUSIONS,
  NR09_METHOD_SUGGESTIONS,
  nr09ConclusionLabel,
  suggestNr09Conclusion,
} from "@/shared/domains/pgr/nr09";
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

// Unidades quantitativas: `qualitative_na` não serve para valor medido (CHECK no banco).
const MEASURED_UNIT_OPTIONS = measurementUnitSchema.options
  .filter((u) => u !== "qualitative_na")
  .map((u) => ({ value: u, label: measurementUnitLabel(u) }));

const CONCLUSION_OPTIONS = NR09_CONCLUSIONS.map((c) => ({
  value: c,
  label: nr09ConclusionLabel(c),
}));

export type AssessmentFormInitial = {
  criterion?: string;
  probability?: number;
  severity?: number;
  uncertaintyDegree?: number;
  toleranceLimit?: string | null;
  assessedAt: string;
  // NR-09 (#39)
  evaluationMethod?: string | null;
  measuredValue?: string | null;
  measuredUnit?: string | null;
  toleranceLimitValue?: string | null;
  nr09Conclusion?: string | null;
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
  nr09Eligible = false,
}: {
  riskId: string;
  assessmentId?: string;
  bands: ClassificationBand[];
  configured: boolean;
  initial: AssessmentFormInitial;
  /** Agente do risco é físico/químico/biológico (#39). O servidor recusa o resto. */
  nr09Eligible?: boolean;
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
  // Bloco NR-09 (#39) — controlado porque a sugestão de conclusão reage aos valores.
  const [evaluationMethod, setEvaluationMethod] = useState(
    initial.evaluationMethod ?? "",
  );
  const [measuredValue, setMeasuredValue] = useState(initial.measuredValue ?? "");
  const [measuredUnit, setMeasuredUnit] = useState(initial.measuredUnit ?? "");
  const [toleranceLimitValue, setToleranceLimitValue] = useState(
    initial.toleranceLimitValue ?? "",
  );
  const [nr09Conclusion, setNr09Conclusion] = useState(initial.nr09Conclusion ?? "");

  const showNr09 = criterion === "quantitative" && nr09Eligible;

  const suggestedConclusion = useMemo(
    () =>
      suggestNr09Conclusion({
        measuredValue,
        measuredUnit: (measuredUnit || null) as never,
        toleranceLimitValue,
      }),
    [measuredValue, measuredUnit, toleranceLimitValue],
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
      // Campos NR-09 só viajam no critério quantitativo e para agente elegível.
      evaluationMethod: showNr09 ? evaluationMethod : "",
      measuredValue: showNr09 ? measuredValue : "",
      measuredUnit: showNr09 ? measuredUnit : "",
      toleranceLimitValue: showNr09 ? toleranceLimitValue : "",
      nr09Conclusion: showNr09 ? nr09Conclusion : "",
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
        <span className="text-text-muted text-sm font-medium">
          Limite de tolerância (referência normativa)
        </span>
        <input
          name="toleranceLimit"
          defaultValue={initial.toleranceLimit ?? ""}
          placeholder="Ex.: NR-15 Anexo 1 — 85 dB(A) para 8h"
          className={inputClass}
        />
        <FieldError message={errors.toleranceLimit} />
      </label>

      {showNr09 ? (
        <fieldset className="glass-card flex flex-col gap-4 p-4">
          <legend className="text-text px-1 text-sm font-semibold">
            Avaliação quantitativa (NR-09)
          </legend>
          <p className="text-text-subtle text-xs">
            Item 9.4.3 da NR-09 — registre o método, a medição e o limite. A conclusão é
            sua: o sistema apenas sugere quando há valor e limite comparáveis.
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-text-muted text-sm font-medium">
              Método de avaliação
            </span>
            <input
              name="evaluationMethod"
              value={evaluationMethod}
              onChange={(e) => setEvaluationMethod(e.target.value)}
              list="nr09-methods"
              placeholder="Ex.: NHO-01 (ruído)"
              className={inputClass}
            />
            <datalist id="nr09-methods">
              {NR09_METHOD_SUGGESTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <FieldError message={errors.evaluationMethod} />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-text-muted text-sm font-medium">Valor medido</span>
              <input
                name="measuredValue"
                inputMode="decimal"
                value={measuredValue}
                onChange={(e) => setMeasuredValue(e.target.value)}
                placeholder="Ex.: 87.5"
                className={inputClass}
              />
              <FieldError message={errors.measuredValue} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-text-muted text-sm font-medium">
                Unidade da medição
              </span>
              <select
                name="measuredUnit"
                value={measuredUnit}
                onChange={(e) => setMeasuredUnit(e.target.value)}
                className={inputClass}
              >
                <option value="">— selecione —</option>
                {MEASURED_UNIT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <FieldError message={errors.measuredUnit} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-text-muted text-sm font-medium">
                Limite de tolerância (valor)
              </span>
              <input
                name="toleranceLimitValue"
                inputMode="decimal"
                value={toleranceLimitValue}
                onChange={(e) => setToleranceLimitValue(e.target.value)}
                placeholder="Ex.: 85"
                className={inputClass}
              />
              <FieldError message={errors.toleranceLimitValue} />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-text-muted text-sm font-medium">
              Conclusão (informada pelo profissional)
            </span>
            <select
              name="nr09Conclusion"
              value={nr09Conclusion}
              onChange={(e) => setNr09Conclusion(e.target.value)}
              className={inputClass}
            >
              <option value="">— não informada —</option>
              {CONCLUSION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {suggestedConclusion ? (
              <span
                role="note"
                className="rounded-card mt-1 border border-amber-300/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-800"
              >
                Sugestão do sistema:{" "}
                <strong>{nr09ConclusionLabel(suggestedConclusion)}</strong> (comparação
                entre valor medido e limite). Confirme, altere ou ignore — o que vale é a
                sua conclusão.{" "}
                {nr09Conclusion !== suggestedConclusion ? (
                  <button
                    type="button"
                    onClick={() => setNr09Conclusion(suggestedConclusion)}
                    className="font-semibold underline"
                  >
                    Usar sugestão
                  </button>
                ) : null}
              </span>
            ) : null}
            <FieldError message={errors.nr09Conclusion} />
          </label>
        </fieldset>
      ) : null}

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
