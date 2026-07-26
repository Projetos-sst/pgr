"use client";

import { deleteRiskAction } from "@/shared/server/actions/pgr/risks";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

export function DeleteRisk({
  id,
  redirectTo,
  withLabel,
}: {
  id: string;
  redirectTo?: string;
  withLabel?: boolean;
}) {
  return (
    <ConfirmDeleteButton
      id={id}
      entityName="Risco"
      deleteAction={deleteRiskAction}
      description="Esta ação é permanente. Avaliações e medidas de controle vinculadas a este risco são removidas em cascata."
      redirectTo={redirectTo}
      withLabel={withLabel}
    />
  );
}
