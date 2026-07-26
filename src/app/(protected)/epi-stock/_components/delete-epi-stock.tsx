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
  itemName,
  redirectTo,
  hasLabel,
}: {
  id: string;
  itemName?: string;
  redirectTo?: string;
  hasLabel?: boolean;
}) {
  return (
    <ConfirmDeleteButton
      id={id}
      entityName={itemName ? `"${itemName}"` : "registro de estoque"}
      deleteAction={deleteEpiStockAction}
      loadDependentsAction={getEpiStockDependentsAction}
      dependentLabels={DEPENDENT_LABELS}
      redirectTo={redirectTo}
      hasLabel={hasLabel}
    />
  );
}
