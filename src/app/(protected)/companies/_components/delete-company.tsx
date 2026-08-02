"use client";

import {
  deleteCompanyAction,
  getCompanyDependentsAction,
} from "@/shared/server/actions/pgr/companies";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

const DEPENDENT_LABELS = {
  workUnits: "Unidades de obra",
  ges: "GES",
  jobRoles: "Funções",
  employees: "Funcionários",
};

export function DeleteCompany({
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
      entityName="empresa"
      deleteAction={deleteCompanyAction}
      loadDependentsAction={getCompanyDependentsAction}
      dependentLabels={DEPENDENT_LABELS}
      redirectTo={redirectTo}
      hasLabel={variant === "text"}
    />
  );
}
