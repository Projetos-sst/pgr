"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";

import type { ActionResult } from "@/shared/server/result";

import { rowActionDangerClass } from "./row-actions";

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
  hasLabel = false,
}: {
  id: string;
  entityName: string;
  deleteAction: DeleteAction;
  loadDependentsAction?: DependentsAction;
  dependentLabels?: Record<string, string>;
  description?: string;
  redirectTo?: string;
  /** Rótulo textual em vez do ícone — para barras de ação fora de tabela. */
  hasLabel?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dependents, setDependents] = useState<Record<string, number> | null>(null);
  const [loadingDependents, setLoadingDependents] = useState(false);
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setError(null);
    setDependents(null);
    setOpen(true);
    if (loadDependentsAction) {
      setLoadingDependents(true);
      loadDependentsAction(id)
        .then((result) => {
          if (result.ok) setDependents(result.data);
        })
        .finally(() => setLoadingDependents(false));
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
        aria-label={`Excluir ${entityName}`}
        title={hasLabel ? undefined : `Excluir ${entityName}`}
        className={
          hasLabel
            ? "cursor-pointer rounded-[12px] border border-red-300/50 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-700 transition-all hover:bg-red-500/20 sm:text-sm"
            : rowActionDangerClass
        }
      >
        {hasLabel ? (
          "Excluir"
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
          </svg>
        )}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <Overlay
              pending={pending}
              onClose={() => setOpen(false)}
              entityName={entityName}
              description={description}
              loadingDependents={loadingDependents}
              dependentEntries={dependentEntries}
              dependentLabels={dependentLabels}
              error={error}
              onConfirm={confirmDelete}
            />,
            document.body,
          )
        : null}
    </>
  );
}

/*
 * Overlay em portal no body: o gatilho fica dentro de `.glass-card`, cujo
 * `backdrop-filter` cria containing block e quebraria o `fixed` do overlay.
 */
function Overlay({
  pending,
  onClose,
  entityName,
  description,
  loadingDependents,
  dependentEntries,
  dependentLabels,
  error,
  onConfirm,
}: {
  pending: boolean;
  onClose: () => void;
  entityName: string;
  description?: string;
  loadingDependents: boolean;
  dependentEntries: [string, number][];
  dependentLabels?: Record<string, string>;
  error: string | null;
  onConfirm: () => void;
}) {
  return (
    <div
      onClick={() => !pending && onClose()}
      className="animate-backdrop-fade fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-pop flex w-full max-w-md flex-col gap-4 rounded-[20px] border border-white/80 bg-white/95 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-600">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h3 className="text-text text-base font-extrabold sm:text-lg">
              Excluir {entityName}?
            </h3>
            <p className="text-text-subtle mt-1 text-xs leading-relaxed sm:text-sm">
              {description ??
                "Esta ação é permanente. Os registros vinculados são removidos em cascata."}
            </p>
          </div>
        </div>

        {loadingDependents ? (
          <div className="text-text-subtle flex items-center gap-2 px-1 text-xs">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
            <span>Verificando vinculações…</span>
          </div>
        ) : dependentEntries.length > 0 ? (
          <ul className="rounded-card border border-amber-300/40 bg-amber-500/10 px-5 py-3 text-xs text-amber-900">
            {dependentEntries.map(([key, count]) => (
              <li key={key} className="font-semibold">
                {dependentLabels?.[key] ?? key}: {count}
              </li>
            ))}
          </ul>
        ) : null}

        {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}

        <div className="flex items-center justify-end gap-3 border-t border-black/5 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="glass-panel text-text-muted hover:text-text cursor-pointer rounded-[12px] px-4 py-2 text-xs font-bold transition-all disabled:opacity-50 sm:text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="cursor-pointer rounded-[12px] bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-red-500/20 transition-all hover:bg-red-700 disabled:opacity-50 sm:text-sm"
          >
            {pending ? "Excluindo…" : "Confirmar exclusão"}
          </button>
        </div>
      </div>
    </div>
  );
}
