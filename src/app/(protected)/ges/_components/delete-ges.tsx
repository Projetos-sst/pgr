"use client";

import { deleteGesAction, getGesDependentsAction } from "@/shared/server/actions/pgr/ges";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

export function DeleteGes({
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
      entityName="GES"
      deleteAction={deleteGesAction}
      loadDependentsAction={getGesDependentsAction}
      dependentLabels={{
        jobRoleLinks: "Vínculos de função (removidos)",
        employees: "Funcionários (ficarão sem GES)",
      }}
      redirectTo={redirectTo}
      withLabel={withLabel}
    />
  );
}
