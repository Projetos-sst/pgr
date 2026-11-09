"use client";

import { deleteHealthExamAction } from "@/shared/server/actions/pgr/health-exams";

import { useActionFeedback } from "../../_ui/use-action-feedback";

/**
 * Exclusão do exame. A recusa do servidor (histórico de ASO ou clínico preservado, permissão,
 * exame não encontrado) aparece ao lado do botão; a página só é atualizada no sucesso.
 */
export function DeleteHealthExam({ id }: { id: string }) {
  const { pending, feedback, run } = useActionFeedback();

  function onDelete() {
    if (!window.confirm("Remover este exame?")) return;
    run(() => deleteHealthExamAction(id));
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        aria-label="Remover exame"
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
      {feedback.formError ? (
        <span role="alert" className="text-xs text-red-700">
          {feedback.formError}
        </span>
      ) : null}
    </span>
  );
}
