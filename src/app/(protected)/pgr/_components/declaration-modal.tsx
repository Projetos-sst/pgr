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
      <div className="glass-card w-full max-w-lg bg-white/90 p-6">
        <h2 className="text-text text-lg font-semibold">
          Declaração de Ciência de Riscos (NR-01)
        </h2>
        <p className="text-text-muted mt-2 text-sm">
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
            className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!accepted || pending}
            className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Confirmar e prosseguir"}
          </button>
        </div>
      </div>
    </div>
  );
}
