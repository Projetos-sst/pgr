"use client";

import { deleteErgonomicEvaluationAction } from "@/shared/server/actions/pgr/ergonomic-evaluations";

import { ConfirmDeleteButton } from "../../../../_ui/confirm-delete-button";

export function DeleteErgonomicEvaluation({
  riskId,
  id,
  redirectTo,
  hasLabel,
}: {
  riskId: string;
  id: string;
  redirectTo?: string;
  hasLabel?: boolean;
}) {
  return (
    <ConfirmDeleteButton
      id={id}
      entityName="Avaliação ergonômica"
      deleteAction={(evaluationId) =>
        deleteErgonomicEvaluationAction(riskId, evaluationId)
      }
      description="Esta ação é permanente e remove apenas esta avaliação do histórico ergonômico do risco."
      redirectTo={redirectTo}
      hasLabel={hasLabel}
    />
  );
}
