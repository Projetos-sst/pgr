"use client";

import { deleteDeliveryAction } from "@/shared/server/actions/pgr/epi-deliveries";

import { ConfirmDeleteButton } from "../../../_ui/confirm-delete-button";

export function DeleteDelivery({ id }: { id: string }) {
  return (
    <ConfirmDeleteButton
      id={id}
      entityName="entrega"
      description="A exclusão só é permitida enquanto a entrega está pendente de assinatura. O saldo baixado não é estornado — retorno de saldo só via devolução."
      deleteAction={async (deliveryId) => {
        const result = await deleteDeliveryAction(deliveryId);
        return result.ok ? { ok: true, data: { id: deliveryId } } : result;
      }}
    />
  );
}
