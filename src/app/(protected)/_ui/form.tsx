"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Classe única de campo do sistema (altura, raio, tipografia, foco). Exportada
 * para telas que montam o próprio arranjo de campos — ex.: as linhas em grade
 * da Metodologia de Risco — e que, sem isto, acabariam reinventando um input
 * com altura e raio próprios.
 */
export const fieldClass =
  "glass-input text-text placeholder:text-text-subtle rounded-field h-[46px] w-full px-3.5 text-[13px] outline-none";
const labelClass = "text-text-muted mb-1.5 block text-xs font-semibold";
const actionButtonClass =
  "hover-lift flex h-[46px] items-center gap-2 rounded-[12px] text-[13px] font-bold transition-all active:scale-95";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-danger mt-1 text-xs">{message}</p>;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-field text-danger border border-red-300 bg-red-50/80 px-3.5 py-2.5 text-[13px]"
    >
      {message}
    </p>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className={labelClass}>
      {label}
      {required ? <span className="text-danger"> *</span> : null}
    </span>
  );
}

/**
 * Bloco de campos do formulário: cartão glass com título em mono/caixa-alta
 * (identidade do redesign). Grade de 2 colunas por padrão — campos individuais
 * pedem a linha inteira via `isFullWidth`.
 */
export function FormSection({
  title,
  description,
  children,
  columns = 2,
  hidden,
}: {
  title: string;
  /** Linha de apoio sob o título — para seções que precisam de contexto. */
  description?: string;
  children: ReactNode;
  columns?: 1 | 2 | 3;
  hidden?: boolean;
}) {
  const columnsClass =
    columns === 1 ? "" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  // A animação de entrada reinicia sozinha quando a seção sai de `display:none`
  // — é o que dá vida à troca de etapa sem remontar os campos (o que apagaria
  // o que já foi preenchido).
  return (
    <section
      className="glass-card animate-fade-slide-up rounded-[20px] p-5 sm:p-6"
      hidden={hidden}
    >
      <h2 className="text-primary font-mono text-[11px] tracking-[0.14em] uppercase">
        {title}
      </h2>
      {description ? (
        <p className="text-text-muted mt-1.5 text-[13px] leading-relaxed">
          {description}
        </p>
      ) : null}
      <div className={`mt-4 grid gap-3.5 ${columnsClass}`}>{children}</div>
    </section>
  );
}

export type FormStep = { title: string; hint: string };

type StepState = "current" | "done" | "invalid" | "pending";

function stepStateOf({
  index,
  current,
  invalidSteps,
}: {
  index: number;
  current: number;
  invalidSteps: number[];
}): StepState {
  if (index === current) return "current";
  if (invalidSteps.includes(index)) return "invalid";
  if (index < current) return "done";
  return "pending";
}

const STEP_CIRCLE_CLASS: Record<StepState, string> = {
  current: "bg-white/25 text-white",
  done: "bg-accent-green text-white",
  invalid: "bg-danger/15 text-danger",
  pending: "bg-text-subtle/20 text-text-subtle",
};

const STEP_HINT_CLASS: Record<StepState, string> = {
  current: "text-white/80",
  done: "text-accent-green",
  invalid: "text-danger",
  pending: "text-text-subtle",
};

/**
 * Indicador de etapas de um formulário multi-step. Vocabulário visual do
 * stepper do redesign: concluída em verde com check, atual em pílula indigo,
 * pendente em cinza. Cada etapa é navegável — os campos das demais continuam
 * montados, então trocar de etapa nunca descarta o que já foi preenchido.
 */
export function FormSteps({
  steps,
  current,
  onSelect,
  invalidSteps = [],
}: {
  steps: FormStep[];
  current: number;
  onSelect: (index: number) => void;
  /** Etapas com erro de validação — sinalizadas para não ficarem escondidas. */
  invalidSteps?: number[];
}) {
  const currentRef = useRef<HTMLLIElement>(null);

  // Em telas estreitas a trilha rola na horizontal: traz a etapa atual à vista.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [current]);

  return (
    <nav
      aria-label="Etapas do cadastro"
      className="glass-card animate-fade-slide-up rounded-[20px] p-3"
    >
      <p className="text-text-subtle mb-2 px-1 font-mono text-[11px] tracking-[0.14em] uppercase sm:hidden">
        Etapa {current + 1} de {steps.length}
      </p>
      <ol className="flex gap-1 overflow-x-auto sm:grid sm:auto-cols-fr sm:grid-flow-col sm:overflow-visible">
        {steps.map((step, index) => {
          const state = stepStateOf({ index, current, invalidSteps });
          const isCurrent = state === "current";
          return (
            <li
              key={step.title}
              ref={isCurrent ? currentRef : undefined}
              className="min-w-[190px] sm:min-w-0"
            >
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex w-full items-center gap-3 rounded-[13px] px-3.5 py-3 text-left text-[13px] transition-all duration-200 active:scale-[0.98] ${
                  isCurrent
                    ? "btn-primary"
                    : "text-text-muted hover:text-text hover:bg-white/40"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${STEP_CIRCLE_CLASS[state]}`}
                >
                  {state === "invalid" ? (
                    "!"
                  ) : state === "done" ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold">{step.title}</span>
                  <span
                    className={`block truncate text-[11px] ${STEP_HINT_CLASS[state]}`}
                  >
                    {state === "invalid" ? "Revise esta etapa" : step.hint}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function TextField({
  label,
  name,
  defaultValue,
  value,
  onChange,
  onBlur,
  type = "text",
  required,
  readOnly,
  suggestions,
  error,
  placeholder,
  isMono,
  isFullWidth,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  required?: boolean;
  readOnly?: boolean;
  /** Valores sugeridos (datalist) — o campo continua aceitando texto livre. */
  suggestions?: readonly string[];
  error?: string;
  placeholder?: string;
  isMono?: boolean;
  isFullWidth?: boolean;
}) {
  const controlled = value !== undefined;
  const listId = suggestions ? `${name}-suggestions` : undefined;
  return (
    <label className={`block ${isFullWidth ? "sm:col-span-full" : ""}`}>
      <FieldLabel label={label} required={required} />
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={`${fieldClass} ${isMono ? "font-mono" : ""}`}
        readOnly={readOnly}
        list={listId}
        onBlur={onBlur}
        {...(controlled
          ? { value, onChange: (e) => onChange?.(e.target.value) }
          : { defaultValue: defaultValue ?? "" })}
      />
      {suggestions ? (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      ) : null}
      <FieldError message={error} />
    </label>
  );
}

export function TextAreaField({
  label,
  name,
  defaultValue,
  value,
  onChange,
  required,
  readOnly,
  error,
  placeholder,
  rows = 4,
  isFullWidth = true,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  readOnly?: boolean;
  error?: string;
  placeholder?: string;
  rows?: number;
  isFullWidth?: boolean;
}) {
  const controlled = value !== undefined;
  return (
    <label className={`block ${isFullWidth ? "sm:col-span-full" : ""}`}>
      <FieldLabel label={label} required={required} />
      <textarea
        name={name}
        rows={rows}
        placeholder={placeholder}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        className="glass-input text-text placeholder:text-text-subtle rounded-field min-h-[88px] w-full resize-y px-3.5 py-3 text-[13px] outline-none"
        {...(controlled
          ? { value, onChange: (e) => onChange?.(e.target.value) }
          : { defaultValue: defaultValue ?? "" })}
      />
      <FieldError message={error} />
    </label>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  value,
  onChange,
  options,
  required,
  error,
  disabled,
  emptyLabel,
  isFullWidth,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  error?: string;
  disabled?: boolean;
  emptyLabel?: string;
  isFullWidth?: boolean;
}) {
  const controlled = value !== undefined;
  return (
    <label className={`block ${isFullWidth ? "sm:col-span-full" : ""}`}>
      <FieldLabel label={label} required={required} />
      <span className="relative block">
        <select
          name={name}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          className={`${fieldClass} appearance-none pr-9 font-semibold disabled:opacity-60`}
          {...(controlled
            ? { value, onChange: (e) => onChange?.(e.target.value) }
            : { defaultValue: defaultValue ?? "" })}
        >
          <option value="">{emptyLabel ?? "— selecione —"}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="text-text-subtle pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[11px]"
        >
          ▾
        </span>
      </span>
      <FieldError message={error} />
    </label>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-3 pt-1">{children}</div>;
}

export function CancelLink({
  href,
  label = "Cancelar",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className={`${actionButtonClass} glass-input text-text-muted hover:text-text px-5`}
    >
      {label}
    </Link>
  );
}

export function StepBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${actionButtonClass} glass-input text-text-muted hover:text-text px-5`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M15 6l-6 6 6 6" />
      </svg>
      Voltar
    </button>
  );
}

export function StepNextButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${actionButtonClass} btn-primary px-6`}
    >
      Continuar
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

export function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${actionButtonClass} btn-primary px-6 disabled:opacity-50`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M5 13l4 4L19 7" />
      </svg>
      {pending ? "Salvando…" : label}
    </button>
  );
}
