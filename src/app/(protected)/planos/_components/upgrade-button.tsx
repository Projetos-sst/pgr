"use client";

import { useState, useTransition } from "react";

import { startProCheckoutAction } from "@/shared/server/actions/platform/billing";

export function UpgradeButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    startTransition(async () => {
      const result = await startProCheckoutAction();
      if (result.ok) {
        window.location.href = result.data.url;
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Redirecionando…" : "Assinar o Pro"}
      </button>
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </div>
  );
}
