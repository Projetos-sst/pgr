"use client";

import { useState, useTransition } from "react";

import { downloadDocumentAction } from "@/shared/server/actions/documents/download";

export function DownloadDocumentButton({ documentId }: { documentId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onDownload() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await downloadDocumentAction(documentId);
        if (result.ok) {
          // URL assinada de curta duração — abre numa aba própria (Content-
          // Disposition força o download; a página do GED continua aberta).
          window.open(result.data.url, "_blank", "noopener,noreferrer");
        } else {
          setError(result.error.message);
        }
      } catch {
        setError("Não foi possível gerar o link de download. Tente novamente.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onDownload}
        disabled={pending}
        className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {pending ? "Gerando…" : "Baixar"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
