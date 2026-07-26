"use client";

import type { ReactNode } from "react";

const inputClass = "glass-input text-text rounded-card px-3 py-2 text-sm outline-none";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600">{message}</p>;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-card border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {message}
    </p>
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
}) {
  const controlled = value !== undefined;
  const listId = suggestions ? `${name}-suggestions` : undefined;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-text-muted text-sm font-semibold">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={name}
        type={type}
        className={inputClass}
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
}) {
  const controlled = value !== undefined;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-text-muted text-sm font-semibold">
        {label}
        {required ? " *" : ""}
      </span>
      <select
        name={name}
        disabled={disabled}
        className={inputClass}
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
      <FieldError message={error} />
    </label>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-3 pt-2">{children}</div>;
}

export function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
    >
      {pending ? "Salvando…" : label}
    </button>
  );
}
