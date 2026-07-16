"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { recordReturnAction } from "@/shared/server/actions/pgr/epi-returns";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Botão de devolver UM item pendente (devolução total do item, data = hoje). Dois cliques
 * (Devolver → Confirmar) evitam acidente; ao concluir, `router.refresh()` remove a linha da
 * lista de pendentes (confirmação visual). Erros do contrato são exibidos inline.
 */
export function ReturnItemButton({
  itemId,
  deliveryId,
}: {
  itemId: string;
  deliveryId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function devolver() {
    setError(null);
    startTransition(async () => {
      const result = await recordReturnAction({
        deliveryId,
        returnDate: todayIso(),
        itemIds: [itemId],
      });
      if (result.ok) {
        router.refresh();
        return;
      }
      setConfirming(false);
      setError(result.error.message);
    });
  }

  if (error) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600">{error}</span>
        <button
          type="button"
          onClick={() => setError(null)}
          className="glass-panel text-text-muted rounded-card hover:text-text px-2 py-1 text-xs font-semibold transition-colors"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={devolver}
          disabled={pending}
          className="btn-primary rounded-pill px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {pending ? "Devolvendo…" : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-xs font-semibold transition-colors"
    >
      Devolver
    </button>
  );
}
