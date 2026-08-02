"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteServiceOrderAction } from "@/shared/server/actions/safety/service-orders";

export function DeleteServiceOrder({
  id,
  redirectTo,
  hasLabel = false,
}: {
  id: string;
  redirectTo?: string;
  hasLabel?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (!window.confirm("Remover esta Ordem de Serviço?")) return;
    startTransition(async () => {
      const result = await deleteServiceOrderAction(id);
      if (result.ok) {
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  if (!hasLabel) {
    return (
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        aria-label="Remover Ordem de Serviço"
        title="Remover"
        className="text-text-subtle flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors hover:bg-red-50 hover:text-[#d33a3f] disabled:opacity-50"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
        </svg>
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="rounded-card border border-red-300 px-3 py-1 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        Remover
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
