"use client";

import {
  deleteEpiCatalogAction,
  getEpiCatalogDependentsAction,
} from "@/shared/server/actions/pgr/epi-catalog";

import { ConfirmDeleteButton } from "../../_ui/confirm-delete-button";

export function DeleteEpiCatalog({
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
      entityName="item de catálogo"
      deleteAction={deleteEpiCatalogAction}
      loadDependentsAction={getEpiCatalogDependentsAction}
      dependentLabels={{
        stock: "Estoque",
        risk: "Vínculos de risco",
        deliveryItems: "Itens de entrega",
      }}
      description="A exclusão é bloqueada se o item tiver estoque, vínculo de risco ou item de entrega. Itens em uso não podem ser removidos."
      redirectTo={redirectTo}
      withLabel={withLabel}
    />
  );
}
