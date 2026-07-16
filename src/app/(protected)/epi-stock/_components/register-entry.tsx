"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { registerStockEntryAction } from "@/shared/server/actions/pgr/stock-movements";

import { FieldError, FormError, SubmitButton, TextField } from "../../_ui/form";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Modal de registro de ENTRADA (compra) de um item de estoque. */
export function RegisterEntry({ stockId }: { stockId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setErrors({});
    setFormError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await registerStockEntryAction({
        stockId,
        quantity: String(fd.get("quantity") ?? ""),
        movementDate: String(fd.get("movementDate") ?? ""),
        invoiceNumber: String(fd.get("invoiceNumber") ?? ""),
      });
      if (result.ok) {
        close();
        router.refresh();
        return;
      }
      setErrors(result.error.fields ?? {});
      setFormError(result.error.fields ? null : result.error.message);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary rounded-pill px-4 py-2 text-sm font-semibold transition-colors"
      >
        Registrar entrada
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card w-full max-w-md bg-white/90 p-6">
            <h2 className="text-text text-lg font-semibold">Registrar entrada</h2>
            <p className="text-text-subtle mt-1 text-sm">
              Entrada por compra — incrementa o saldo do item.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
              <FormError message={formError} />
              <TextField
                label="Data do movimento"
                name="movementDate"
                type="date"
                required
                defaultValue={todayIso()}
                error={errors.movementDate}
              />
              <TextField
                label="Quantidade"
                name="quantity"
                type="number"
                required
                error={errors.quantity}
              />
              <TextField
                label="Nº da nota fiscal"
                name="invoiceNumber"
                error={errors.invoiceNumber}
              />
              <FieldError message={errors._} />
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <SubmitButton pending={pending} label="Registrar entrada" />
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
