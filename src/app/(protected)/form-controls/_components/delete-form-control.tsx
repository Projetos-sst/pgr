"use client";

import { deleteFormControlAction } from "@/shared/server/actions/documents/form-controls";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

export function DeleteFormControl({
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
      entityName="controle de formulário"
      deleteAction={deleteFormControlAction}
      description="Esta ação é permanente. A configuração de cabeçalho ISO será removida."
      redirectTo={redirectTo}
      hasLabel={hasLabel}
    />
  );
}
