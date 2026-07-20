"use client";

import { useState, useTransition, type FormEvent } from "react";

import {
  buildMatrix,
  methodologyBaseLabel,
  riskClassificationLabel,
  RISK_CLASSIFICATION_ORDER,
  type MethodologyBase,
  type RiskClassification,
  type RiskMethodologyView,
} from "@/shared/domains/pgr/methodology";
import {
  METHODOLOGY_PRESETS,
  NR01_CONTROL_HIERARCHY,
} from "@/shared/domains/pgr/methodology-presets";
import { saveRiskMethodologyAction } from "@/shared/server/actions/pgr/risk-methodology";

import { FormError, SelectField, SubmitButton } from "../../_ui/form";

/** Cores por classe (strings literais para o Tailwind v4 capturar no scan). */
const CLASSIFICATION_STYLE: Record<RiskClassification, string> = {
  trivial: "bg-green-100 text-green-900",
  tolerable: "bg-lime-100 text-lime-900",
  moderate: "bg-yellow-100 text-yellow-900",
  substantial: "bg-orange-100 text-orange-900",
  intolerable: "bg-red-100 text-red-900",
};

const BASE_OPTIONS: { value: MethodologyBase; label: string }[] = [
  { value: "aiha", label: methodologyBaseLabel("aiha") },
  { value: "as_nzs_4360", label: methodologyBaseLabel("as_nzs_4360") },
  { value: "fundacentro", label: methodologyBaseLabel("fundacentro") },
  { value: "custom", label: methodologyBaseLabel("custom") },
];

const inputClass = "glass-input text-text rounded-card px-3 py-2 text-sm outline-none";

type State = Omit<RiskMethodologyView, "configured">;

export function MethodologyEditor({ initial }: { initial: RiskMethodologyView }) {
  const [state, setState] = useState<State>({
    base: initial.base,
    probabilityGrades: initial.probabilityGrades,
    severityGrades: initial.severityGrades,
    classificationBands: initial.classificationBands,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const matrix = buildMatrix(state.classificationBands);

  function onBaseChange(value: string) {
    const base = value as MethodologyBase;
    // Preenche gradações e faixas com o preset da base (editável).
    setState({ base, ...METHODOLOGY_PRESETS[base] });
    setSaved(false);
  }

  function updateGrade(
    axis: "probabilityGrades" | "severityGrades",
    index: number,
    field: "label" | "description",
    value: string,
  ) {
    setState((prev) => ({
      ...prev,
      [axis]: prev[axis].map((g, i) => (i === index ? { ...g, [field]: value } : g)),
    }));
    setSaved(false);
  }

  function updateBand(index: number, maxLevel: number) {
    setState((prev) => ({
      ...prev,
      classificationBands: prev.classificationBands.map((b, i) =>
        i === index ? { ...b, maxLevel } : b,
      ),
    }));
    setSaved(false);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveRiskMethodologyAction(state);
      if (result.ok) {
        setSaved(true);
      } else {
        setError(result.error.message || "Não foi possível salvar a metodologia.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      {!initial.configured ? (
        <p className="rounded-card border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Sua organização ainda não configurou uma metodologia — exibindo os valores
          padrão ({methodologyBaseLabel(state.base)}). Ajuste e salve para adotá-la.
        </p>
      ) : null}

      <section className="max-w-xs">
        <SelectField
          label="Base da metodologia"
          name="base"
          value={state.base}
          onChange={onBaseChange}
          options={BASE_OPTIONS}
          emptyLabel="— selecione —"
        />
        <p className="text-text-subtle mt-1 text-xs">
          Selecionar uma base preenche gradações e faixas com os valores padrão
          (editáveis).
        </p>
      </section>

      <GradeSection
        title="Gradação de Probabilidade (1–5)"
        grades={state.probabilityGrades}
        onChange={(i, field, v) => updateGrade("probabilityGrades", i, field, v)}
      />

      <GradeSection
        title="Gradação de Severidade (1–5)"
        grades={state.severityGrades}
        onChange={(i, field, v) => updateGrade("severityGrades", i, field, v)}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-text text-lg font-semibold">Matriz 5×5</h2>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1 text-center text-sm">
            <thead>
              <tr>
                <th className="text-text-subtle p-2 text-xs font-medium">P \ S</th>
                {state.severityGrades.map((g) => (
                  <th key={g.level} className="p-2 text-xs font-medium">
                    {g.level}. {g.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.probabilityGrades.map((pg) => (
                <tr key={pg.level}>
                  <th className="p-2 text-left text-xs font-medium whitespace-nowrap">
                    {pg.level}. {pg.label}
                  </th>
                  {state.severityGrades.map((sg) => {
                    const cell = matrix.find(
                      (c) => c.probability === pg.level && c.severity === sg.level,
                    )!;
                    return (
                      <td
                        key={sg.level}
                        className={`min-w-24 rounded-md p-2 ${CLASSIFICATION_STYLE[cell.classification]}`}
                        title={riskClassificationLabel(cell.classification)}
                      >
                        <div className="font-semibold">{cell.level}</div>
                        <div className="text-xs">
                          {riskClassificationLabel(cell.classification)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-text text-sm font-medium">
            Faixas de classificação (limite superior)
          </h3>
          <div className="flex flex-wrap gap-3">
            {state.classificationBands.map((band, index) => {
              const prev =
                index === 0 ? 1 : state.classificationBands[index - 1].maxLevel + 1;
              const isLast = index === RISK_CLASSIFICATION_ORDER.length - 1;
              return (
                <label
                  key={band.classification}
                  className={`flex flex-col gap-1 rounded-md p-2 ${CLASSIFICATION_STYLE[band.classification]}`}
                >
                  <span className="text-xs font-medium">
                    {riskClassificationLabel(band.classification)} ({prev}–{band.maxLevel}
                    )
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={band.maxLevel}
                    disabled={isLast}
                    onChange={(e) => updateBand(index, Number(e.target.value))}
                    className={`w-20 ${inputClass} disabled:opacity-60`}
                  />
                </label>
              );
            })}
          </div>
          <p className="text-text-subtle text-xs">
            Os limites devem ser crescentes; a última faixa fecha sempre em 25.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-text text-lg font-semibold">
          Controle de Riscos (hierarquia NR-01)
        </h2>
        <ol className="flex flex-col gap-2">
          {NR01_CONTROL_HIERARCHY.map((item) => (
            <li key={item.level} className="glass-card px-3 py-2 text-sm">
              <span className="text-text font-medium">{item.label}</span>
              <span className="text-text-muted"> — {item.description}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-col gap-2">
        <FormError message={error} />
        {saved ? (
          <p
            role="status"
            className="rounded-card border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700"
          >
            Metodologia salva.
          </p>
        ) : null}
        <div>
          <SubmitButton pending={pending} label="Salvar metodologia" />
        </div>
      </div>
    </form>
  );
}

function GradeSection({
  title,
  grades,
  onChange,
}: {
  title: string;
  grades: { level: number; label: string; description?: string }[];
  onChange: (index: number, field: "label" | "description", value: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-text text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-2">
        {grades.map((grade, index) => (
          <div
            key={grade.level}
            className="grid grid-cols-[2rem_1fr_2fr] items-center gap-3"
          >
            <span className="text-text-muted text-sm font-semibold">{grade.level}</span>
            <input
              aria-label={`Rótulo do nível ${grade.level}`}
              value={grade.label}
              onChange={(e) => onChange(index, "label", e.target.value)}
              className={inputClass}
              placeholder="Rótulo"
            />
            <input
              aria-label={`Descrição do nível ${grade.level}`}
              value={grade.description ?? ""}
              onChange={(e) => onChange(index, "description", e.target.value)}
              className={inputClass}
              placeholder="Descrição"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
