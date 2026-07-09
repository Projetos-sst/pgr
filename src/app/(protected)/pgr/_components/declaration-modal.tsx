"use client";

import { useState } from "react";

/**
 * Gate da Declaração de Ciência de Riscos (NR-01) exibido antes de criar o PGR.
 * O aceite habilita "Confirmar e prosseguir"; a validação definitiva é do servidor
 * (o aceite NÃO é persistido).
 */
export function DeclarationModal({
  open,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [accepted, setAccepted] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-black/10 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Declaração de Ciência de Riscos (NR-01)</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Declaro estar ciente dos riscos ocupacionais identificados e das medidas de
          controle previstas neste Programa de Gerenciamento de Riscos (PGR), conforme a
          NR-01 / GRO, e assumo a responsabilidade pelas informações prestadas.
        </p>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5"
          />
          <span>Li e aceito a Declaração de Ciência de Riscos.</span>
        </label>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!accepted || pending}
            className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {pending ? "Salvando…" : "Confirmar e prosseguir"}
          </button>
        </div>
      </div>
    </div>
  );
}
