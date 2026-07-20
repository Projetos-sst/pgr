"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import type { DocumentListItem } from "@/shared/domains/documents/documents";
import { updateDocumentAction } from "@/shared/server/actions/documents/documents";

export function EditDocumentModal({ doc }: { doc: DocumentListItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(doc.name);
  const [docType, setDocType] = useState(doc.docType);
  const [validUntil, setValidUntil] = useState(doc.validUntil ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openModal() {
    setName(doc.name);
    setDocType(doc.docType);
    setValidUntil(doc.validUntil ?? "");
    setError(null);
    setOpen(true);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateDocumentAction(doc.id, {
        name,
        docType,
        validUntil,
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
        Editar
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card w-full max-w-md bg-white/90 p-6">
            <h2 className="text-text text-lg font-bold">Editar documento</h2>
            <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-text-muted text-sm font-semibold">Nome</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-text-muted text-sm font-semibold">Tipo</span>
                <input
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-text-muted text-sm font-semibold">
                  Validade (opcional)
                </span>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
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
                  disabled={pending}
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
