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
      if (r.ok) router.push("/psychosocial/campaigns");
      else setError(r.error.message);
    });
  }

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
  }

  return (
    <div className="glass-card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Status: {status}</span>
        {status === "draft" || status === "closed" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => changeStatus("active")}
            className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Ativar
          </button>
        ) : null}
        {status === "active" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => changeStatus("closed")}
            className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Encerrar
          </button>
        ) : null}
        {status !== "archived" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => changeStatus("archived")}
            className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Arquivar
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={onDelete}
          className="rounded-card border border-red-300 px-3 py-1 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          Excluir
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          Link público (envie aos trabalhadores)
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <code className="glass-card max-w-md truncate px-2 py-1 text-xs">
            {publicUrl}
          </code>
          <button
            type="button"
            onClick={copyLink}
            className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
          >
            {copied ? "Copiado!" : "Copiar link"}
          </button>
        </div>
        <p className="text-text-subtle text-xs">
          Ative a campanha para que o link aceite respostas.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
