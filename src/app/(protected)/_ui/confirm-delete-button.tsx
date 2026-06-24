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
        className="rounded-md border border-red-300 px-3 py-1 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        Excluir
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-black/10 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Excluir {entityName}?</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {description ??
                "Esta ação é permanente. Os registros vinculados são removidos em cascata (ou desvinculados), conforme a integridade do banco."}
            </p>

            {dependentEntries.length > 0 ? (
              <ul className="mt-3 list-disc rounded-md bg-amber-50 px-6 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
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
                className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={pending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
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
