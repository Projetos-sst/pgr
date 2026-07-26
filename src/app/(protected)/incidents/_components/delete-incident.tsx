"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteAccidentAction } from "@/shared/server/actions/safety/accidents";

import { TrashIcon, rowActionDangerClass } from "../../_ui/row-actions";

export function DeleteIncident({
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
    if (!window.confirm("Remover este incidente/acidente?")) return;
    startTransition(async () => {
      const result = await deleteAccidentAction(id);
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
        aria-label="Remover incidente"
        title={withLabel ? undefined : "Remover incidente"}
        className={
          withLabel
            ? "rounded-card border border-red-300 px-3 py-1 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
            : `${rowActionDangerClass} disabled:opacity-50`
        }
      >
        {withLabel ? "Remover" : <TrashIcon />}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
