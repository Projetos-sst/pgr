"use client";

import { deleteEmployeeAction } from "@/shared/server/actions/pgr/employees";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

export function DeleteEmployee({
  id,
  redirectTo,
  variant = "icon",
}: {
  id: string;
  redirectTo?: string;
  variant?: "text" | "icon";
}) {
  return (
    <ConfirmDeleteButton
      id={id}
      entityName="funcionário"
      deleteAction={deleteEmployeeAction}
      redirectTo={redirectTo}
      variant={variant}
    />
  );
}
