"use client";

import {
  deleteJobRoleAction,
  getJobRoleDependentsAction,
} from "@/shared/server/actions/pgr/job-roles";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

export function DeleteJobRole({ id, redirectTo }: { id: string; redirectTo?: string }) {
  return (
    <ConfirmDeleteButton
      id={id}
      entityName="função"
      deleteAction={deleteJobRoleAction}
      loadDependentsAction={getJobRoleDependentsAction}
      dependentLabels={{ gesLinks: "Vínculos com GES", employees: "Funcionários" }}
      redirectTo={redirectTo}
    />
  );
}
