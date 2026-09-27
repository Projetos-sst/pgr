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

import {
  CancelLink,
  FieldError,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
  TextField,
} from "../../../../_ui/form";

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
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-[22px]">
      <FormError message={formError} />

      {!configured ? (
        <p className="rounded-field border border-amber-300 bg-amber-50/80 px-3.5 py-2.5 text-[13px] text-amber-800">
          A organização ainda não configurou uma metodologia de risco. A classificação usa
          a <strong>metodologia padrão</strong> até que uma seja definida.
        </p>
      ) : null}

      <FormSection title="Avaliação do risco (matriz 5×5)">
        <SelectField
          label="Critério"
          name="criterion"
          required
          value={criterion}
          onChange={setCriterion}
          options={CRITERION_OPTIONS}
          error={errors.criterion}
        />
        <TextField
          label="Data da avaliação"
          name="assessedAt"
          type="date"
          required
          defaultValue={initial.assessedAt}
          error={errors.assessedAt}
        />
        <SelectField
          label="Probabilidade"
          name="probability"
          required
          value={probability}
          onChange={setProbability}
          options={PROBABILITY_OPTIONS}
          error={errors.probability}
        />
        <SelectField
          label="Severidade"
          name="severity"
          required
          value={severity}
          onChange={setSeverity}
          options={SEVERITY_OPTIONS}
          error={errors.severity}
        />
        <SelectField
          label="Grau de incerteza"
          name="uncertaintyDegree"
          required
          value={uncertaintyDegree}
          onChange={setUncertaintyDegree}
          options={UNCERTAINTY_OPTIONS}
          error={errors.uncertaintyDegree}
        />
        <TextField
          label="Limite de tolerância (referência normativa)"
          name="toleranceLimit"
          placeholder="Ex.: NR-15 Anexo 1 — 85 dB(A) para 8h"
          defaultValue={initial.toleranceLimit ?? ""}
          error={errors.toleranceLimit}
          isFullWidth
        />
      </FormSection>

      {showNr09 ? (
        <FormSection title="Avaliação quantitativa (NR-09)" columns={3}>
          <p className="text-text-subtle text-xs sm:col-span-full">
            Item 9.4.3 da NR-09 — registre o método, a medição e o limite. A conclusão é
            sua: o sistema apenas sugere quando há valor e limite comparáveis.
          </p>
          <TextField
            label="Método de avaliação"
            name="evaluationMethod"
            value={evaluationMethod}
            onChange={setEvaluationMethod}
            suggestions={NR09_METHOD_SUGGESTIONS}
            placeholder="Ex.: NHO-01 (ruído)"
            error={errors.evaluationMethod}
            isFullWidth
          />
          <TextField
            label="Valor medido"
            name="measuredValue"
            value={measuredValue}
            onChange={setMeasuredValue}
            placeholder="Ex.: 87.5"
            isMono
            error={errors.measuredValue}
          />
          <SelectField
            label="Unidade da medição"
            name="measuredUnit"
            value={measuredUnit}
            onChange={setMeasuredUnit}
            options={MEASURED_UNIT_OPTIONS}
            emptyLabel="— selecione —"
            error={errors.measuredUnit}
          />
          <TextField
            label="Limite de tolerância (valor)"
            name="toleranceLimitValue"
            value={toleranceLimitValue}
            onChange={setToleranceLimitValue}
            placeholder="Ex.: 85"
            isMono
            error={errors.toleranceLimitValue}
          />
          <SelectField
            label="Conclusão (informada pelo profissional)"
            name="nr09Conclusion"
            value={nr09Conclusion}
            onChange={setNr09Conclusion}
            options={CONCLUSION_OPTIONS}
            emptyLabel="— não informada —"
            error={errors.nr09Conclusion}
            isFullWidth
          />
          {suggestedConclusion ? (
            <p
              role="note"
              className="rounded-field border border-amber-300/60 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 sm:col-span-full"
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
            </p>
          ) : null}
        </FormSection>
      ) : null}

      <section className="glass-card animate-fade-slide-up grid gap-4 rounded-[20px] p-5 sm:grid-cols-2 sm:p-6">
        <div className="flex flex-col">
          <span className="text-text-subtle font-mono text-[11px] tracking-[0.14em] uppercase">
            Nível de risco (calculado)
          </span>
          <span className="text-text text-2xl font-bold">
            {preview ? preview.riskLevel : "—"}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-text-subtle font-mono text-[11px] tracking-[0.14em] uppercase">
            Classificação (prevista)
          </span>
          <span className="text-text text-lg font-semibold">
            {preview ? riskClassificationLabel(preview.result) : "—"}
          </span>
          {preview ? (
            <p className="text-text-subtle text-[13px]">
              {riskClassificationGuidance(preview.result)}
            </p>
          ) : null}
        </div>
      </section>

      <FieldError message={errors._} />
      <FormActions>
        <CancelLink href={`/risks/${riskId}/assessments`} />
        <SubmitButton
          pending={pending}
          label={assessmentId ? "Salvar alterações" : "Criar avaliação"}
        />
      </FormActions>
    </form>
  );
}
