"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { concludeCampaignAction } from "@/shared/server/actions/psychosocial/campaigns";

export function ConcludeButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onConclude() {
    if (!window.confirm("Encerrar a campanha? Novas respostas serão bloqueadas.")) return;
    startTransition(async () => {
      const r = await concludeCampaignAction(id);
      if (r.ok) router.refresh();
      else setError(r.error.message);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={onConclude}
        className="btn-primary rounded-pill w-fit px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        Encerrar campanha
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
