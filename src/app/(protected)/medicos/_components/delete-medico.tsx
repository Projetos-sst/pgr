"use client";

import { deleteMedicoAction } from "@/shared/server/actions/pgr/medicos";

import { FormError } from "../../_ui/form";
import { useActionFeedback } from "../../_ui/use-action-feedback";

/**
 * Exclusão do profissional. A recusa do servidor (ex.: examinador de exames registrados ou
 * coordenador com histórico → IN_USE) aparece junto do botão, em vez de a exclusão falhar calada.
 */
export function DeleteMedico({ id }: { id: string }) {
  const { pending, feedback, run } = useActionFeedback();

  function onDelete() {
    if (!window.confirm("Remover este médico?")) return;
    run(() => deleteMedicoAction(id));
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        aria-label="Remover médico"
        title="Remover"
        className="text-text-subtle flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors hover:bg-red-50 hover:text-[#d33a3f] disabled:opacity-50"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
        </svg>
      </button>
      <FormError message={feedback.formError} details={feedback.details} />
    </span>
  );
}
