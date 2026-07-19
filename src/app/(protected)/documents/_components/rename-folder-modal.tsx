"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { renameFolderAction } from "@/shared/server/actions/documents/folders";

export function RenameFolderModal({
  folderId,
  currentName,
}: {
  folderId: string;
  currentName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openModal() {
    setName(currentName);
    setError(null);
    setOpen(true);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await renameFolderAction(folderId, name);
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
        className="text-text-subtle hover:text-text text-xs underline"
      >
        renomear
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card w-full max-w-sm bg-white/90 p-6">
            <h2 className="text-text text-lg font-bold">Renomear pasta</h2>
            <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-text-muted text-sm font-semibold">Nome</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
                />
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
                  disabled={pending || name.trim() === ""}
                  className="btn-primary rounded-pill px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {pending ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
