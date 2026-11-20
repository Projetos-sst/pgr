"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";

import {
  AI_FILL_LABEL,
  AI_FILLED_LABEL,
  AI_REVIEW_DISMISSED_KEY,
  AI_REVIEW_TITLE,
  AI_REVIEW_WARNING,
  AI_SAVE_TITLE,
  TERMS_PATH,
} from "@/shared/domains/platform/ai-review";

import { ConfirmModal } from "./confirm-modal";

function SparklesIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );
}

function TermsLink() {
  return (
    <Link
      href={TERMS_PATH}
      target="_blank"
      className="text-primary text-xs font-bold underline-offset-2 hover:underline sm:text-sm"
    >
      Ver termos de uso
    </Link>
  );
}

export function useAiGenerateWarning(onGenerate: () => void): {
  request: () => void;
  modal: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const request = useCallback(() => {
    if (localStorage.getItem(AI_REVIEW_DISMISSED_KEY) === "true") {
      onGenerate();
      return;
    }
    setDontShowAgain(false);
    setOpen(true);
  }, [onGenerate]);

  const cancel = useCallback(() => setOpen(false), []);

  const confirm = useCallback(() => {
    if (dontShowAgain) localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
    setOpen(false);
    onGenerate();
  }, [dontShowAgain, onGenerate]);

  const modal = (
    <ConfirmModal
      open={open}
      variant="primary"
      icon={<SparklesIcon />}
      title={AI_REVIEW_TITLE}
      description={AI_REVIEW_WARNING}
      confirmLabel="Entendi, preencher"
      cancelLabel="Cancelar"
      onConfirm={confirm}
      onCancel={cancel}
    >
      <div className="bg-primary/5 rounded-[14px] px-4 py-3">
        <p className="text-text-muted text-xs leading-relaxed sm:text-sm">
          Os campos preenchidos ficam marcados com{" "}
          <strong className="text-text">{AI_FILLED_LABEL}</strong> até você revisar. Nada
          é salvo sem a sua confirmação.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-text flex cursor-pointer items-center gap-2.5 text-xs font-semibold sm:text-sm">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(event) => setDontShowAgain(event.target.checked)}
            className="accent-primary h-4 w-4 shrink-0"
          />
          Não mostrar novamente
        </label>
        <TermsLink />
      </div>
    </ConfirmModal>
  );

  return { request, modal };
}

export function AiSaveConfirm({
  open,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmModal
      open={open}
      pending={pending}
      variant="warning"
      icon={<SparklesIcon />}
      title={AI_SAVE_TITLE}
      description={AI_REVIEW_WARNING}
      confirmLabel="Confirmar e salvar"
      cancelLabel="Voltar e revisar"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="rounded-[14px] bg-amber-500/10 px-4 py-3">
        <p className="text-text-muted text-xs leading-relaxed sm:text-sm">
          Ao confirmar, você declara que revisou cada campo preenchido pela IA e assume a
          responsabilidade pelo conteúdo salvo.
        </p>
      </div>
      <TermsLink />
    </ConfirmModal>
  );
}

export function AiFillButton({
  onClick,
  pending = false,
  disabled = false,
}: {
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      aria-busy={pending}
      className="btn-primary rounded-pill inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold disabled:opacity-50"
    >
      <SparklesIcon size={16} />
      {pending ? "Preenchendo…" : AI_FILL_LABEL}
    </button>
  );
}

export function AiFilledBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`rounded-pill bg-primary/10 text-primary inline-flex w-fit items-center gap-1 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${className}`}
    >
      <SparklesIcon size={12} />
      {AI_FILLED_LABEL}
    </span>
  );
}
