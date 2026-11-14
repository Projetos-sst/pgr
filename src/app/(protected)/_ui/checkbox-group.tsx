"use client";

import { useId } from "react";

import { FieldError } from "./form";

export type CheckboxOption = { value: string; label: string; disabled?: boolean };

export function CheckboxGroupField({
  legend,
  name,
  options,
  values,
  onChange,
  error,
  disabled,
}: {
  legend: string;
  name: string;
  options: readonly CheckboxOption[];
  values: readonly string[];
  onChange: (values: string[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  const errorId = useId();
  const toggle = (value: string, checked: boolean) =>
    onChange(
      checked ? [...values, value] : values.filter((current) => current !== value),
    );
  return (
    <fieldset
      disabled={disabled}
      aria-describedby={error ? errorId : undefined}
      className="min-w-0"
    >
      <legend className="text-text-muted mb-1.5 block text-xs font-semibold">
        {legend}
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="glass-input rounded-field text-text focus-within:outline-primary flex min-h-[46px] cursor-pointer items-center gap-3 px-3.5 text-[13px] font-semibold focus-within:outline-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={values.includes(option.value)}
              disabled={option.disabled}
              onChange={(event) => toggle(option.value, event.target.checked)}
              className="accent-primary h-4 w-4 shrink-0"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}
