"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteCampaignAction,
  setCampaignStatusAction,
} from "@/shared/server/actions/psychosocial/campaigns";

export function CampaignControls({
  id,
  status,
  publicUrl,
}: {
  id: string;
  status: string;
  publicUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function changeStatus(next: string) {
    startTransition(async () => {
      const r = await setCampaignStatusAction(id, next);
      if (r.ok) {
        setError(null);
        router.refresh();
      } else {
        setError(r.error.message);
      }
    });
  }

  function onDelete() {
    if (!window.confirm("Excluir a campanha e todo o histórico?")) return;
    startTransition(async () => {
      const r = await deleteCampaignAction(id);
      if (r.ok) router.push("/psicossocial/campanhas");
      else setError(r.error.message);
    });
  }

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Status: {status}</span>
        {status === "draft" || status === "closed" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => changeStatus("active")}
            className="rounded-md border border-black/15 px-3 py-1 text-sm disabled:opacity-50 dark:border-white/15"
          >
            Ativar
          </button>
        ) : null}
        {status === "active" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => changeStatus("closed")}
            className="rounded-md border border-black/15 px-3 py-1 text-sm disabled:opacity-50 dark:border-white/15"
          >
            Encerrar
          </button>
        ) : null}
        {status !== "archived" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => changeStatus("archived")}
            className="rounded-md border border-black/15 px-3 py-1 text-sm disabled:opacity-50 dark:border-white/15"
          >
            Arquivar
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={onDelete}
          className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
        >
          Excluir
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          Link público (envie aos trabalhadores)
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <code className="max-w-md truncate rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10">
            {publicUrl}
          </code>
          <button
            type="button"
            onClick={copyLink}
            className="rounded-md border border-black/15 px-3 py-1 text-sm dark:border-white/15"
          >
            {copied ? "Copiado!" : "Copiar link"}
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          Ative a campanha para que o link aceite respostas.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
