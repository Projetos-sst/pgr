"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ActionResult } from "@/shared/server/result";

type DeleteAction = (id: string) => Promise<ActionResult<{ id: string }>>;
type DependentsAction = (id: string) => Promise<ActionResult<Record<string, number>>>;

export function ConfirmDeleteButton({
  id,
  entityName,
  deleteAction,
  loadDependentsAction,
  dependentLabels,
  description,
  redirectTo,
}: {
  id: string;
  entityName: string;
  deleteAction: DeleteAction;
  loadDependentsAction?: DependentsAction;
  dependentLabels?: Record<string, string>;
  description?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dependents, setDependents] = useState<Record<string, number> | null>(null);
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setError(null);
    setDependents(null);
    setOpen(true);
    if (loadDependentsAction) {
      startTransition(async () => {
        const result = await loadDependentsAction(id);
        if (result.ok) setDependents(result.data);
      });
    }
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteAction(id);
      if (result.ok) {
        setOpen(false);
        if (redirectTo) router.push(redirectTo);
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  const dependentEntries = dependents
    ? Object.entries(dependents).filter(([, count]) => count > 0)
    : [];

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="rounded-card border border-red-300 px-3 py-1 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
      >
        Excluir
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card w-full max-w-md bg-white/90 p-6">
            <h2 className="text-text text-lg font-bold">Excluir {entityName}?</h2>
            <p className="text-text-muted mt-2 text-sm">
              {description ??
                "Esta ação é permanente. Os registros vinculados são removidos em cascata (ou desvinculados), conforme a integridade do banco."}
            </p>

            {dependentEntries.length > 0 ? (
              <ul className="rounded-card mt-3 list-disc bg-amber-50 px-6 py-3 text-sm text-amber-800">
                {dependentEntries.map(([key, count]) => (
                  <li key={key}>
                    {dependentLabels?.[key] ?? key}: {count}
                  </li>
                ))}
              </ul>
            ) : null}

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
                {pending ? "Excluindo…" : "Confirmar exclusão"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
