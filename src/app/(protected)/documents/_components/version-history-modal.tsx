"use client";

import { useState, useTransition } from "react";

import type { DocumentVersionItem } from "@/shared/domains/documents/versions";
import { listDocumentVersionsAction } from "@/shared/server/actions/documents/documents";

import { DownloadDocumentButton } from "./download-document-button";
import { formatBytes, formatDateTimeBr, formatIsoDateBr } from "./format";

/**
 * Histórico de versões do documento lógico (#56). Somente leitura: cada versão pode ser
 * baixada, mas edição/nova versão/mover/excluir continuam na linha do documento, que é
 * sempre a versão vigente. O backend também recusa edição de versão antiga (409).
 */
export function VersionHistoryModal({
  documentId,
  documentName,
}: {
  documentId: string;
  documentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<DocumentVersionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onOpen() {
    setOpen(true);
    setError(null);
    setVersions(null);
    startTransition(async () => {
      try {
        const result = await listDocumentVersionsAction(documentId);
        if (result.ok) setVersions(result.data);
        else setError(result.error.message);
      } catch {
        setError("Não foi possível carregar o histórico. Tente novamente.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        title="Histórico de versões"
        aria-label="Histórico de versões"
        className="text-text-muted hover:text-primary rounded-lg p-1.5 transition-colors hover:bg-white/60"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <polyline points="3 3 3 8 8 8" />
          <polyline points="12 7 12 12 15 14" />
        </svg>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`version-history-${documentId}`}
        >
          <div className="glass-card flex max-h-[85vh] w-full max-w-lg flex-col bg-white/90 p-6">
            <h2
              id={`version-history-${documentId}`}
              className="text-text text-lg font-bold"
            >
              Histórico de versões
            </h2>
            <p className="text-text-muted mt-1 truncate text-sm">{documentName}</p>

            <div className="mt-4 flex-1 overflow-y-auto">
              {pending && !versions ? (
                <p className="text-text-subtle text-sm">Carregando…</p>
              ) : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {versions ? (
                <ul className="flex flex-col gap-2">
                  {versions.map((version) => (
                    <li
                      key={version.id}
                      className="rounded-card flex items-center justify-between gap-3 border border-black/5 bg-white/60 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-text font-mono text-sm font-bold">
                            v{version.version}
                          </span>
                          {version.isCurrent ? (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                              Vigente
                            </span>
                          ) : (
                            <span className="text-text-muted rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold">
                              Somente leitura
                            </span>
                          )}
                        </div>
                        <p className="text-text-subtle mt-0.5 text-xs">
                          Enviada em {formatDateTimeBr(version.createdAt)} ·{" "}
                          {formatBytes(version.sizeBytes)} ·{" "}
                          {version.validUntil
                            ? `Validade ${formatIsoDateBr(version.validUntil)}`
                            : "Sem validade"}
                        </p>
                      </div>
                      <DownloadDocumentButton documentId={version.id} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
