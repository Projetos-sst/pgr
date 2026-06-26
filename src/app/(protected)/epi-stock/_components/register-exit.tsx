"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { registerStockExitAction } from "@/shared/server/actions/pgr/stock-movements";
import { STOCK_EXIT_TYPES } from "@/shared/domains/pgr/stock-movements";

import {
  FieldError,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const EXIT_TYPE_OPTIONS: { value: (typeof STOCK_EXIT_TYPES)[number]; label: string }[] = [
  { value: "adjustment", label: "Ajuste" },
  { value: "discard", label: "Descarte" },
];

/** Modal de registro de SAÍDA manual (ajuste/descarte) de um item de estoque. */
export function RegisterExit({ stockId }: { stockId: string }) {
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
      const result = await registerStockExitAction({
        stockId,
        quantity: String(fd.get("quantity") ?? ""),
        movementDate: String(fd.get("movementDate") ?? ""),
        type: String(fd.get("type") ?? "") as (typeof STOCK_EXIT_TYPES)[number],
      });
      if (result.ok) {
        close();
        router.refresh();
        return;
      }
      // Saldo insuficiente vem sem `fields` → exibe a mensagem do contrato no topo.
      setErrors(result.error.fields ?? {});
      setFormError(result.error.fields ? null : result.error.message);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
      >
        Registrar saída
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-black/10 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Registrar saída</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Saída manual (ajuste ou descarte) — decrementa o saldo. Não permite saldo
              negativo.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
              <FormError message={formError} />
              <SelectField
                label="Tipo"
                name="type"
                required
                options={EXIT_TYPE_OPTIONS}
                defaultValue="adjustment"
                error={errors.type}
              />
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
              <FieldError message={errors._} />
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
                >
                  Cancelar
                </button>
                <SubmitButton pending={pending} label="Registrar saída" />
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
