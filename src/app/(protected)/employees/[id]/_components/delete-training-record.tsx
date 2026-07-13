"use client";

import { deleteTrainingRecordAction } from "@/shared/server/actions/pgr/training-records";

import { ConfirmDeleteButton } from "../../../_ui/confirm-delete-button";

export function DeleteTrainingRecord({ id }: { id: string }) {
  return (
    <ConfirmDeleteButton
      id={id}
      entityName="realização de treinamento"
      deleteAction={deleteTrainingRecordAction}
      description="Esta ação é permanente. O registro sai do histórico e do cômputo de vencimento/conformidade."
    />
  );
}
