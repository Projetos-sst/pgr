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
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={onDownload}
        disabled={pending}
        title="Visualizar / Baixar"
        aria-label="Visualizar ou baixar documento"
        className="rounded-lg p-1.5 text-[#5b63f5] transition-colors hover:bg-[#5b63f5]/10 hover:text-[#4f46e5] disabled:opacity-50"
      >
        {pending ? (
          <span className="text-xs font-semibold">…</span>
        ) : (
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        )}
      </button>
      {error ? (
        <span className="text-[10px] font-medium text-red-600">{error}</span>
      ) : null}
    </div>
  );
}
