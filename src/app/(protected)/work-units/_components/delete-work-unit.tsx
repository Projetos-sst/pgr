"use client";

import {
  deleteWorkUnitAction,
  getWorkUnitDependentsAction,
} from "@/shared/server/actions/pgr/work-units";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

export function DeleteWorkUnit({
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
      entityName="unidade de obra"
      deleteAction={deleteWorkUnitAction}
      loadDependentsAction={getWorkUnitDependentsAction}
      dependentLabels={{ ges: "GES vinculados" }}
      redirectTo={redirectTo}
      hasLabel={hasLabel}
    />
  );
}
