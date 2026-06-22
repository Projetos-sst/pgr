"use client";

import { deleteEmployeeAction } from "@/shared/server/actions/pgr/employees";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

export function DeleteEmployee({ id, redirectTo }: { id: string; redirectTo?: string }) {
  return (
    <ConfirmDeleteButton
      id={id}
      entityName="funcionário"
      deleteAction={deleteEmployeeAction}
      redirectTo={redirectTo}
    />
  );
}
