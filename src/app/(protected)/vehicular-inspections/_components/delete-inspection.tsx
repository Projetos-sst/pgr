"use client";

import { deleteVehicularInspectionAction } from "@/shared/server/actions/inspections/vehicular-inspections";
import type { ActionResult } from "@/shared/server/result";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

// A ação devolve `{ deleted: true }`; o botão de confirmação trabalha com
// `{ id }` — adaptação local, sem alterar o contrato da Server Action.
async function deleteInspection(id: string): Promise<ActionResult<{ id: string }>> {
  const result = await deleteVehicularInspectionAction(id);
  return result.ok ? { ok: true, data: { id } } : result;
}

export function DeleteInspection({
  id,
  hasLabel,
  redirectTo,
}: {
  id: string;
  hasLabel?: boolean;
  redirectTo?: string;
}) {
  return (
    <ConfirmDeleteButton
      id={id}
      entityName="inspeção veicular"
      description="Esta ação é permanente. As respostas do checklist desta inspeção são removidas junto."
      deleteAction={deleteInspection}
      hasLabel={hasLabel}
      redirectTo={redirectTo}
    />
  );
}
