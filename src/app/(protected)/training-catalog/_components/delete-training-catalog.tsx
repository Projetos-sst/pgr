"use client";

import {
  deleteTrainingCatalogAction,
  getTrainingCatalogDependentsAction,
} from "@/shared/server/actions/pgr/training-catalog";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

const DEPENDENT_LABELS: Record<string, string> = {
  records: "Realizações registradas",
  requiredLinks: "Obrigatórios por função",
};

export function DeleteTrainingCatalog({
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
      entityName="treinamento"
      deleteAction={deleteTrainingCatalogAction}
      loadDependentsAction={getTrainingCatalogDependentsAction}
      dependentLabels={DEPENDENT_LABELS}
      description="Esta ação é permanente. Treinamentos com realizações registradas ou vinculados como obrigatórios a funções não podem ser excluídos."
      redirectTo={redirectTo}
      withLabel={withLabel}
    />
  );
}
