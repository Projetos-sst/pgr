"use client";

import { deleteControlMeasureAction } from "@/shared/server/actions/pgr/control-measures";

import { ConfirmDeleteButton } from "../../../../_ui/confirm-delete-button";

export function DeleteControlMeasure({
  riskId,
  id,
  redirectTo,
  withLabel,
}: {
  riskId: string;
  id: string;
  redirectTo?: string;
  withLabel?: boolean;
}) {
  return (
    <ConfirmDeleteButton
      id={id}
      entityName="Medida de controle"
      deleteAction={(measureId) => deleteControlMeasureAction(riskId, measureId)}
      description="Esta ação é permanente e remove apenas esta medida de controle do risco, liberando o nível NR-01 para novo cadastro."
      redirectTo={redirectTo}
      withLabel={withLabel}
    />
  );
}
