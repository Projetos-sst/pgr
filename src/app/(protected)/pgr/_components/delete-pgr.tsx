"use client";

import { deletePgrAction } from "@/shared/server/actions/pgr/pgr";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

export function DeletePgr({
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
      entityName="PGR"
      deleteAction={deletePgrAction}
      description="Esta ação é permanente. Vínculos futuros (GES e revisões) associados a este PGR são removidos em cascata."
      redirectTo={redirectTo}
      hasLabel={hasLabel}
    />
  );
}
