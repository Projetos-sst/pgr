"use client";

import { deleteCategoryAction } from "@/shared/server/actions/pgr/categories";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

export function DeleteCategory({ id, redirectTo }: { id: string; redirectTo?: string }) {
  return (
    <ConfirmDeleteButton
      id={id}
      entityName="categoria"
      deleteAction={deleteCategoryAction}
      description="Esta ação é permanente. A categoria será removida do catálogo do escritório."
      redirectTo={redirectTo}
    />
  );
}
