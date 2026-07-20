"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import type { FolderNode } from "@/shared/domains/documents/folders";
import { listFolderTreeAction } from "@/shared/server/actions/documents/folders";
import { moveDocumentAction } from "@/shared/server/actions/documents/documents";

export function MoveDocumentModal({
  documentId,
  currentFolderId,
}: {
  documentId: string;
  currentFolderId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [folderId, setFolderId] = useState(currentFolderId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openModal() {
    setError(null);
    setFolderId(currentFolderId ?? "");
    setOpen(true);
    startTransition(async () => {
      const result = await listFolderTreeAction(null);
      if (result.ok) setFolders(result.data.folders);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await moveDocumentAction(documentId, {
        folderId: folderId === "" ? null : folderId,
      });
      if (result.ok) {
        setOpen(false);
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
      >
        Mover
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card w-full max-w-sm bg-white/90 p-6">
            <h2 className="text-text text-lg font-bold">Mover documento</h2>
            <p className="text-text-muted mt-1 text-sm">
              Todas as versões do documento são movidas junto.
            </p>
            <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-text-muted text-sm font-semibold">
                  Pasta destino
                </span>
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
                >
                  <option value="">— Início (raiz) —</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-primary rounded-pill px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {pending ? "Movendo…" : "Mover"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
