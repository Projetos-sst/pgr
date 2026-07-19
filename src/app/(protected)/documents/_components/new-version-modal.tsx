"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { addDocumentVersionAction } from "@/shared/server/actions/documents/documents";

import { UPLOAD_TRANSPORT_ERROR_MESSAGE } from "./format";

export function NewVersionModal({
  documentId,
  currentVersion,
}: {
  documentId: string;
  currentVersion: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await addDocumentVersionAction(documentId, formData);
        if (result.ok) {
          setOpen(false);
          router.refresh();
          return;
        }
        setError(result.error.message);
      } catch {
        // Corpo maior do que o proxy/Server Action aceitam (transporte, não
        // validação) — a Server Action lança em vez de devolver {ok:false}.
        setError(UPLOAD_TRANSPORT_ERROR_MESSAGE);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
      >
        Nova versão
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card w-full max-w-md bg-white/90 p-6">
            <h2 className="text-text text-lg font-bold">Enviar nova versão</h2>
            <p className="text-text-muted mt-1 text-sm">
              Versão atual: v{currentVersion}. O histórico é preservado.
            </p>
            <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-text-muted text-sm font-semibold">Arquivo</span>
                <input
                  type="file"
                  name="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
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
                  {pending ? "Enviando…" : "Enviar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
