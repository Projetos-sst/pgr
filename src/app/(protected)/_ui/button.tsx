"use client";

import type { ReactNode } from "react";

type ButtonVariant = "primary" | "secondary";

const BASE_CLASS =
  "hover-lift flex h-[46px] items-center justify-center gap-2 rounded-[12px] px-6 text-[13px] font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "glass-input text-text-muted hover:text-text",
};

export function Button({
  label,
  pendingLabel = "Processando…",
  onClick,
  type = "button",
  variant = "primary",
  pending = false,
  disabled = false,
  children,
}: {
  label: string;
  pendingLabel?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: ButtonVariant;
  pending?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={`${BASE_CLASS} ${VARIANT_CLASS[variant]}`}
    >
      {children}
      {pending ? pendingLabel : label}
    </button>
  );
}
