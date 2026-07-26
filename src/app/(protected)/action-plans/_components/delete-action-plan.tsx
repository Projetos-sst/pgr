"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteActionPlanAction } from "@/shared/server/actions/safety/action-plans";

import { TrashIcon, rowActionDangerClass } from "../../_ui/row-actions";

export function DeleteActionPlan({
  id,
  redirectTo,
  withLabel,
}: {
  id: string;
  redirectTo?: string;
  withLabel?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (!window.confirm("Excluir este plano de ação? (só planos não iniciados)")) return;
    startTransition(async () => {
      const result = await deleteActionPlanAction(id);
      if (result.ok) {
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        aria-label="Excluir plano de ação"
        title={withLabel ? undefined : "Excluir plano de ação"}
        className={
          withLabel
            ? "rounded-card border border-red-300 px-3 py-1 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
            : `${rowActionDangerClass} disabled:opacity-50`
        }
      >
        {withLabel ? "Excluir" : <TrashIcon />}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
