"use client";

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";

import {
  buildMatrix,
  methodologyBaseLabel,
  riskClassificationLabel,
  RISK_CLASSIFICATION_ORDER,
  type ClassificationBand,
  type MethodologyBase,
  type MethodologyGrade,
  type RiskClassification,
  type RiskMethodologyView,
} from "@/shared/domains/pgr/methodology";
import {
  METHODOLOGY_PRESETS,
  NR01_CONTROL_HIERARCHY,
} from "@/shared/domains/pgr/methodology-presets";
import { saveRiskMethodologyAction } from "@/shared/server/actions/pgr/risk-methodology";

import {
  fieldClass,
  FieldError,
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
} from "../../_ui/form";

/** Cores por classe (strings literais para o Tailwind v4 capturar no scan). */
const CLASSIFICATION_STYLE: Record<RiskClassification, string> = {
  trivial: "bg-green-100 text-green-900",
  tolerable: "bg-lime-100 text-lime-900",
  moderate: "bg-yellow-100 text-yellow-900",
  substantial: "bg-orange-100 text-orange-900",
  intolerable: "bg-red-100 text-red-900",
};

/** Ponto de cor da faixa — a cor nunca é o único indicador, acompanha o nome. */
const CLASSIFICATION_DOT: Record<RiskClassification, string> = {
  trivial: "bg-green-500",
  tolerable: "bg-lime-500",
  moderate: "bg-yellow-500",
  substantial: "bg-orange-500",
  intolerable: "bg-red-500",
};

const BASE_OPTIONS: { value: MethodologyBase; label: string }[] = [
  { value: "aiha", label: methodologyBaseLabel("aiha") },
  { value: "as_nzs_4360", label: methodologyBaseLabel("as_nzs_4360") },
  { value: "fundacentro", label: methodologyBaseLabel("fundacentro") },
  { value: "custom", label: methodologyBaseLabel("custom") },
];

const columnHeadClass =
  "text-text-muted font-mono text-[10px] tracking-[0.14em] uppercase";

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
    <form onSubmit={onSubmit} className="flex flex-col gap-[22px]">
      {!initial.configured ? (
        <NotConfiguredNotice baseLabel={methodologyBaseLabel(state.base)} />
      ) : null}

      <FormSection
        title="Base da metodologia"
        description="Selecionar uma base preenche gradações e faixas com os valores padrão (editáveis)."
        columns={1}
      >
        <div className="sm:max-w-[340px]">
          <SelectField
            label="Base da metodologia"
            name="base"
            value={state.base}
            onChange={onBaseChange}
            options={BASE_OPTIONS}
            emptyLabel="— selecione —"
          />
        </div>
      </FormSection>

      <GradeSection
        title="Gradação de probabilidade (1–5)"
        description="Como a organização descreve cada nível da dimensão probabilidade."
        axisName="probabilidade"
        grades={state.probabilityGrades}
        onChange={(i, field, v) => updateGrade("probabilityGrades", i, field, v)}
      />

      <GradeSection
        title="Gradação de severidade (1–5)"
        description="Como a organização descreve cada nível da dimensão severidade."
        axisName="severidade"
        grades={state.severityGrades}
        onChange={(i, field, v) => updateGrade("severityGrades", i, field, v)}
      />

      <FormSection
        title="Matriz de riscos 5×5"
        description="Nível de risco = probabilidade × severidade. A classe de cada célula vem das faixas abaixo e acompanha o que for editado."
        columns={1}
      >
        <MatrixTable
          probabilityGrades={state.probabilityGrades}
          severityGrades={state.severityGrades}
          matrix={matrix}
        />
      </FormSection>

      <FormSection
        title="Faixas de classificação"
        description="Limite superior de cada classe. Os limites devem ser crescentes; a última faixa fecha sempre em 25."
        columns={1}
      >
        <BandCards bands={state.classificationBands} onChange={updateBand} />
      </FormSection>

      <FormSection
        title="Controle de riscos — hierarquia NR-01"
        description="Ordem de prioridade das medidas de controle. Conteúdo normativo, apenas informativo."
        columns={1}
      >
        <ControlHierarchy />
      </FormSection>

      <div className="glass-card animate-fade-slide-up flex flex-col gap-3 rounded-[20px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0 flex-1">
          {error ? (
            <FormError message={error} />
          ) : saved ? (
            <p
              role="status"
              className="rounded-field border-accent-green/35 bg-accent-green/10 text-accent-green border px-3.5 py-2.5 text-[13px] font-semibold"
            >
              Metodologia salva.
            </p>
          ) : (
            <p className="text-text-muted text-[13px]">
              As alterações só valem para novas avaliações depois de salvas.
            </p>
          )}
        </div>
        <SubmitButton pending={pending} label="Salvar metodologia" />
      </div>
    </form>
  );
}

/**
 * Aviso de "ainda sem metodologia". Usa o mesmo vocabulário do aviso inline do
 * sistema (`ges-form`): amber-300 / amber-50 / amber-800 — a combinação com
 * contraste suficiente para texto de 13px.
 */
function NotConfiguredNotice({ baseLabel }: { baseLabel: string }) {
  return (
    <p className="animate-fade-slide-up rounded-[20px] border border-amber-300 bg-amber-50/80 px-5 py-3.5 text-[13px] leading-relaxed text-amber-800">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
        className="-mt-0.5 mr-2 inline-block align-middle"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5v.01" />
      </svg>
      Sua organização ainda não configurou uma metodologia — exibindo os valores padrão (
      {baseLabel}). Ajuste e salve para adotá-la.
    </p>
  );
}

function GradeSection({
  title,
  description,
  axisName,
  grades,
  onChange,
}: {
  title: string;
  description: string;
  /** Entra nos rótulos de acessibilidade: "Rótulo do nível 3 de severidade". */
  axisName: string;
  grades: MethodologyGrade[];
  onChange: (index: number, field: "label" | "description", value: string) => void;
}) {
  return (
    <FormSection title={title} description={description} columns={1}>
      {/* Cabeçalho da grade: só onde as colunas existem. No mobile cada campo
          carrega o próprio rótulo (abaixo). */}
      <div
        aria-hidden
        className="hidden grid-cols-[2.75rem_minmax(0,1.05fr)_minmax(0,1.95fr)] gap-3.5 px-1 sm:grid"
      >
        <span className={columnHeadClass}>Nível</span>
        <span className={columnHeadClass}>Rótulo</span>
        <span className={columnHeadClass}>Descrição</span>
      </div>

      {grades.map((grade, index) => (
        <div
          key={grade.level}
          className="grid grid-cols-1 items-center gap-2.5 sm:grid-cols-[2.75rem_minmax(0,1.05fr)_minmax(0,1.95fr)] sm:gap-3.5"
        >
          <span
            aria-hidden
            className="bg-primary-ring text-primary flex h-9 w-9 items-center justify-center rounded-[11px] text-[13px] font-extrabold"
          >
            {grade.level}
          </span>
          <label className="block">
            <span className="text-text-muted mb-1 block text-[11px] font-semibold sm:hidden">
              Rótulo
            </span>
            <input
              aria-label={`Rótulo do nível ${grade.level} de ${axisName}`}
              value={grade.label}
              onChange={(e) => onChange(index, "label", e.target.value)}
              className={fieldClass}
              placeholder="Rótulo"
            />
          </label>
          <label className="block">
            <span className="text-text-muted mb-1 block text-[11px] font-semibold sm:hidden">
              Descrição
            </span>
            <input
              aria-label={`Descrição do nível ${grade.level} de ${axisName}`}
              value={grade.description ?? ""}
              onChange={(e) => onChange(index, "description", e.target.value)}
              className={fieldClass}
              placeholder="Descrição"
            />
          </label>
        </div>
      ))}
    </FormSection>
  );
}

function MatrixTable({
  probabilityGrades,
  severityGrades,
  matrix,
}: {
  probabilityGrades: MethodologyGrade[];
  severityGrades: MethodologyGrade[];
  matrix: ReturnType<typeof buildMatrix>;
}) {
  return (
    /* `min-w-0` nos dois níveis: item de grid/flex tem `min-width: auto` e, sem
       isto, a largura mínima da tabela empurra o cartão — e a página inteira —
       para fora da viewport em vez de rolar aqui dentro. */
    <div className="flex min-w-0 flex-col gap-2.5">
      {/* A rolagem fica DENTRO do cartão — a página nunca ganha barra horizontal. */}
      <div className="-mx-1 min-w-0 overflow-x-auto px-1 pb-1">
        <table className="w-full min-w-[680px] table-fixed border-separate border-spacing-1.5 text-center">
          <caption className="sr-only">
            Matriz de risco 5×5: as linhas são os níveis de probabilidade e as colunas os
            de severidade; cada célula traz o nível de risco e a classe correspondente.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-[140px] p-1 text-left sm:w-[164px]">
                <span className={`${columnHeadClass} block`}>Prob. ↓</span>
                <span className={`${columnHeadClass} block`}>Sev. →</span>
              </th>
              {severityGrades.map((g) => (
                <th
                  key={g.level}
                  scope="col"
                  className="text-text-muted p-1 align-bottom text-[11px] leading-tight font-semibold"
                >
                  <span className="font-mono">{g.level}.</span> {g.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {probabilityGrades.map((pg) => (
              <tr key={pg.level}>
                <th
                  scope="row"
                  className="text-text-muted p-1 text-left text-[11px] leading-tight font-semibold"
                >
                  <span className="font-mono">{pg.level}.</span> {pg.label}
                </th>
                {severityGrades.map((sg) => {
                  const cell = matrix.find(
                    (c) => c.probability === pg.level && c.severity === sg.level,
                  )!;
                  return (
                    <td
                      key={sg.level}
                      className={`h-[62px] rounded-[12px] px-2 py-2 ring-1 ring-black/5 ring-inset ${CLASSIFICATION_STYLE[cell.classification]}`}
                    >
                      <div className="text-[17px] leading-none font-extrabold">
                        {cell.level}
                      </div>
                      <div className="mt-1 text-[11px] leading-tight font-semibold">
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
      <p className="text-text-muted text-[11px] lg:hidden">
        Role a matriz para o lado para ver todas as colunas.
      </p>
    </div>
  );
}

function BandCards({
  bands,
  onChange,
}: {
  bands: ClassificationBand[];
  onChange: (index: number, maxLevel: number) => void;
}) {
  const idPrefix = useId();
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      {bands.map((band, index) => {
        const from = index === 0 ? 1 : bands[index - 1].maxLevel + 1;
        const isLast = index === RISK_CLASSIFICATION_ORDER.length - 1;
        // Espelha a regra do servidor (limites estritamente crescentes) para o
        // erro aparecer junto do campo; o servidor continua sendo a autoridade.
        const isOutOfOrder = index > 0 && band.maxLevel <= bands[index - 1].maxLevel;
        const inputId = `${idPrefix}-${band.classification}`;
        return (
          <div
            key={band.classification}
            className="glass-input rounded-[14px] p-3.5 sm:p-4"
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${CLASSIFICATION_DOT[band.classification]}`}
              />
              <span className="text-text truncate text-[13px] font-bold">
                {riskClassificationLabel(band.classification)}
              </span>
            </div>
            <p className="text-text-muted mt-1 font-mono text-[11px]">
              nível {from}–{band.maxLevel}
            </p>
            <label
              htmlFor={inputId}
              className="text-text-muted mt-3 mb-1 block text-[11px] font-semibold"
            >
              Limite superior
            </label>
            <input
              id={inputId}
              type="number"
              min={1}
              max={25}
              value={band.maxLevel}
              disabled={isLast}
              aria-invalid={isOutOfOrder || undefined}
              aria-describedby={isLast ? `${inputId}-hint` : undefined}
              onChange={(e) => onChange(index, Number(e.target.value))}
              className={`${fieldClass} font-mono disabled:opacity-60`}
            />
            {isLast ? (
              <p id={`${inputId}-hint`} className="text-text-muted mt-1 text-[11px]">
                Fixo em 25.
              </p>
            ) : null}
            <FieldError
              message={
                isOutOfOrder
                  ? `Deve ser maior que ${bands[index - 1].maxLevel}.`
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Separa o algarismo romano do nome na etiqueta canônica ("I — Eliminação"),
 * só para a apresentação: o rótulo do domínio é compartilhado com as telas de
 * medidas de controle e não muda. Sem o separador, devolve a etiqueta inteira.
 */
export function splitControlLabel(label: string): { index: string; name: string } {
  const match = /^([IVX]+)\s+—\s+(.*)$/.exec(label);
  return match ? { index: match[1], name: match[2] } : { index: "", name: label };
}

function ControlHierarchy(): ReactNode {
  return (
    <ol className="grid gap-2.5">
      {NR01_CONTROL_HIERARCHY.map((item) => {
        const { index, name } = splitControlLabel(item.label);
        return (
          <li
            key={item.level}
            className="glass-input flex items-start gap-3.5 rounded-[14px] p-3.5"
          >
            {index ? (
              <span
                aria-hidden
                className="bg-primary-ring text-primary mt-0.5 flex h-8 w-9 shrink-0 items-center justify-center rounded-[10px] font-mono text-[12px] font-bold"
              >
                {index}
              </span>
            ) : null}
            <div className="min-w-0">
              <span className="text-text block text-[13px] font-bold">{name}</span>
              <span className="text-text-muted block text-[12px] leading-relaxed">
                {item.description}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
