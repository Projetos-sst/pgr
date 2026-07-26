"use client";

import {
  deleteEpiStockAction,
  getEpiStockDependentsAction,
} from "@/shared/server/actions/pgr/epi-stock";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

const DEPENDENT_LABELS = {
  movements: "Movimentações que serão excluídas",
};

export function DeleteEpiStock({
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
      entityName="registro de estoque"
      deleteAction={deleteEpiStockAction}
      loadDependentsAction={getEpiStockDependentsAction}
      dependentLabels={DEPENDENT_LABELS}
      redirectTo={redirectTo}
      withLabel={withLabel}
    />
  );
}
