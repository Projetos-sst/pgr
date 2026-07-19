"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteDocumentAction } from "@/shared/server/actions/documents/documents";

export function DeleteDocumentButton({
  documentId,
  name,
}: {
  documentId: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteDocumentAction(documentId);
      if (result.ok) {
        setOpen(false);
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="rounded-card border border-red-300 px-3 py-1 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
      >
        Excluir
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card w-full max-w-md bg-white/90 p-6">
            <h2 className="text-text text-lg font-bold">Excluir &quot;{name}&quot;?</h2>
            <p className="text-text-muted mt-2 text-sm">
              Esta ação é permanente e remove <strong>todas as versões</strong> deste
              documento, não só a atual.
            </p>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={pending}
                className="rounded-card bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Excluindo…" : "Excluir todas as versões"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
