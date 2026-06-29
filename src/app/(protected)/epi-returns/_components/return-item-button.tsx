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
          className="rounded-md border border-black/15 px-2 py-1 text-xs transition-colors hover:bg-black/5 dark:border-white/15"
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
          className="rounded-md bg-black px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Devolvendo…" : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-md border border-black/15 px-3 py-1 text-xs transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15"
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
      className="rounded-md border border-black/15 px-3 py-1 text-xs font-medium transition-colors hover:bg-black/5 dark:border-white/15"
    >
      Devolver
    </button>
  );
}
