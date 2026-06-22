"use client";

import {
  deleteWorkUnitAction,
  getWorkUnitDependentsAction,
} from "@/shared/server/actions/pgr/work-units";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

export function DeleteWorkUnit({ id, redirectTo }: { id: string; redirectTo?: string }) {
  return (
    <ConfirmDeleteButton
      id={id}
      entityName="unidade de obra"
      deleteAction={deleteWorkUnitAction}
      loadDependentsAction={getWorkUnitDependentsAction}
      dependentLabels={{ ges: "GES vinculados" }}
      redirectTo={redirectTo}
    />
  );
}
