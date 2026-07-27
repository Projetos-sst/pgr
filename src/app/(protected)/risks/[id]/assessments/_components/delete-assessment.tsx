"use client";

import { deleteRiskAssessmentAction } from "@/shared/server/actions/pgr/risk-assessments";

import { ConfirmDeleteButton } from "../../../../_ui/confirm-delete-button";

export function DeleteAssessment({
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
      entityName="Avaliação"
      deleteAction={(assessmentId) => deleteRiskAssessmentAction(riskId, assessmentId)}
      description="Esta ação é permanente e remove apenas esta avaliação do histórico do risco."
      redirectTo={redirectTo}
      hasLabel={hasLabel}
    />
  );
}
