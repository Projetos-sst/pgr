"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { returnDeliveryItemAction } from "@/shared/server/actions/pgr/epi-deliveries";

/**
 * Devolução de item da entrega (US4): one-shot — devolvido mostra a data;
 * em uso mostra o botão "Devolver" (repõe o saldo via `employee_return`).
 */
export function ReturnItem({
  deliveryId,
  itemId,
  returnedAt,
}: {
  deliveryId: string;
  itemId: string;
  returnedAt: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (returnedAt) {
    return (
      <span className="text-text-subtle text-xs">
        Devolvido em {new Date(returnedAt).toLocaleDateString("pt-BR")}
      </span>
    );
  }

  function handleReturn() {
    startTransition(async () => {
      const result = await returnDeliveryItemAction(deliveryId, { itemId });
      if (result.ok) {
        setError(null);
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleReturn}
        disabled={pending}
        className="glass-panel text-text-muted rounded-card hover:text-text px-2 py-0.5 text-xs font-semibold transition-colors disabled:opacity-50"
      >
        {pending ? "Aguarde…" : "Devolver"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
