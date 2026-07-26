"use client";

import { deleteEmployeeAction } from "@/shared/server/actions/pgr/employees";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

export function DeleteEmployee({
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
      entityName="funcionário"
      deleteAction={deleteEmployeeAction}
      redirectTo={redirectTo}
      withLabel={withLabel}
    />
  );
}
