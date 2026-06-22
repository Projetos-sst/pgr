"use client";

import type { ReactNode } from "react";

const inputClass =
  "rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:bg-zinc-900";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600">{message}</p>;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40"
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
  type = "text",
  required,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  type?: string;
  required?: boolean;
  error?: string;
}) {
  const controlled = value !== undefined;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={name}
        type={type}
        className={inputClass}
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
      <span className="text-sm font-medium">
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
      className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black"
    >
      {pending ? "Salvando…" : label}
    </button>
  );
}
