"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

const fieldClass =
  "glass-input text-text placeholder:text-text-subtle rounded-field h-[46px] w-full px-3.5 text-[13px] outline-none";
const labelClass = "text-text-muted mb-1.5 block text-xs font-semibold";
const actionButtonClass =
  "flex h-[46px] items-center gap-2 rounded-[12px] text-[13px] font-bold transition-colors";

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
 * pedem a linha inteira via `full`.
 */
export function FormSection({
  title,
  children,
  columns = 2,
  hidden,
}: {
  title: string;
  children: ReactNode;
  columns?: 1 | 2 | 3;
  hidden?: boolean;
}) {
  const columnsClass =
    columns === 1 ? "" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <section className="glass-card rounded-[20px] p-5 sm:p-6" hidden={hidden}>
      <h2 className="text-primary mb-4 font-mono text-[11px] tracking-[0.14em] uppercase">
        {title}
      </h2>
      <div className={`grid gap-3.5 ${columnsClass}`}>{children}</div>
    </section>
  );
}

export type FormStep = { title: string; hint: string };

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
    <nav aria-label="Etapas do cadastro" className="glass-card rounded-[20px] p-3">
      <p className="text-text-subtle mb-2 px-1 font-mono text-[11px] tracking-[0.14em] uppercase sm:hidden">
        Etapa {current + 1} de {steps.length}
      </p>
      <ol className="flex gap-1 overflow-x-auto sm:grid sm:auto-cols-fr sm:grid-flow-col sm:overflow-visible">
        {steps.map((step, index) => {
          const isCurrent = index === current;
          const hasError = invalidSteps.includes(index);
          const isDone = index < current && !hasError;
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
                className={`flex w-full items-center gap-3 rounded-[13px] px-3.5 py-3 text-left text-[13px] transition-colors ${
                  isCurrent
                    ? "btn-primary"
                    : "text-text-muted hover:text-text hover:bg-white/40"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                    isCurrent
                      ? "bg-white/25 text-white"
                      : isDone
                        ? "bg-accent-green text-white"
                        : hasError
                          ? "bg-danger/15 text-danger"
                          : "bg-text-subtle/20 text-text-subtle"
                  }`}
                >
                  {hasError && !isCurrent ? (
                    "!"
                  ) : isDone ? (
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
                    className={`block truncate text-[11px] ${
                      isCurrent
                        ? "text-white/80"
                        : isDone
                          ? "text-accent-green"
                          : hasError
                            ? "text-danger"
                            : "text-text-subtle"
                    }`}
                  >
                    {hasError && !isCurrent ? "Revise esta etapa" : step.hint}
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
  mono,
  full,
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
  mono?: boolean;
  full?: boolean;
}) {
  const controlled = value !== undefined;
  const listId = suggestions ? `${name}-suggestions` : undefined;
  return (
    <label className={`block ${full ? "sm:col-span-full" : ""}`}>
      <FieldLabel label={label} required={required} />
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={`${fieldClass} ${mono ? "font-mono" : ""}`}
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
  full,
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
  full?: boolean;
}) {
  const controlled = value !== undefined;
  return (
    <label className={`block ${full ? "sm:col-span-full" : ""}`}>
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
