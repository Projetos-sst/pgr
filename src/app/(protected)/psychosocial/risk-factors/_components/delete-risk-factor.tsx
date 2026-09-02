"use client";

import { deletePsychosocialRiskFactorAction } from "@/shared/server/actions/psychosocial/risk-factors";

import { ConfirmDeleteButton } from "../../../_ui/confirm-delete-button";

export function DeleteRiskFactor({
  id,
  redirectTo,
  hasLabel,
}: {
  id: string;
  redirectTo?: string;
  hasLabel?: boolean;
}) {
  return (
    <ConfirmDeleteButton
      id={id}
      entityName="fator de risco"
      deleteAction={deletePsychosocialRiskFactorAction}
      description="Esta ação é permanente e remove o fator de risco psicossocial do catálogo."
      redirectTo={redirectTo}
      hasLabel={hasLabel}
    />
  );
}
