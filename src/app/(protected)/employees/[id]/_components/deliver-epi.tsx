"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { createDeliveryAction } from "@/shared/server/actions/pgr/epi-deliveries";
import { listEpiStockAction } from "@/shared/server/actions/pgr/epi-stock";
import type { EpiStockListItem } from "@/shared/domains/pgr/epi-stock";

const inputClass =
  "rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:bg-zinc-900";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "Entregar EPI" (US2): seleção de itens do estoque COM saldo disponível
 * (`listEpiStock withBalanceOnly`, fatia 010 — nenhum backend novo) + data →
 * confirmação chama `createDeliveryAction` (baixa transacional; saldo
 * insuficiente → erro e nada é gravado).
 */
export function DeliverEpi({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [stock, setStock] = useState<EpiStockListItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [deliveryDate, setDeliveryDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      const result = await listEpiStockAction({
        withBalanceOnly: true,
        search: search || undefined,
        pageSize: 100,
      });
      if (!active) return;
      setStock(result.ok ? result.data.rows : []);
    })();
    return () => {
      active = false;
    };
  }, [open, search]);

  function toggleItem(stockId: string, checked: boolean) {
    setQuantities((prev) => {
      const next = { ...prev };
      if (checked) next[stockId] = next[stockId] ?? "1";
      else delete next[stockId];
      return next;
    });
  }

  function openDialog() {
    setError(null);
    setQuantities({});
    setSearch("");
    setDeliveryDate(todayIso());
    setOpen(true);
  }

  function confirmDelivery() {
    const items = Object.entries(quantities).map(([stockId, quantity]) => ({
      stockId,
      quantity,
    }));
    if (items.length === 0) {
      setError("Selecione ao menos um item.");
      return;
    }
    startTransition(async () => {
      const result = await createDeliveryAction({ employeeId, deliveryDate, items });
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
        onClick={openDialog}
        className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 dark:bg-white dark:text-black"
      >
        Entregar EPI
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-lg border border-black/10 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Preparar entrega</h2>

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Data da entrega</span>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex grow flex-col gap-1 text-sm">
                <span className="font-medium">Buscar por CA ou nome</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ex.: 31469 ou Capacete"
                  className={inputClass}
                />
              </label>
            </div>

            {stock.length === 0 ? (
              <p className="rounded-lg border border-dashed border-black/15 px-4 py-6 text-center text-sm text-zinc-500 dark:border-white/15">
                Nenhum item de estoque com saldo disponível.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-black/3 text-left dark:bg-white/5">
                    <tr>
                      {["", "CA", "EPI", "Tam.", "Und.", "Disponível", "Quantidade"].map(
                        (header) => (
                          <th key={header} className="px-3 py-2 font-medium">
                            {header}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map((item) => {
                      const selected = item.id in quantities;
                      return (
                        <tr
                          key={item.id}
                          className="border-t border-black/5 dark:border-white/5"
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => toggleItem(item.id, e.target.checked)}
                              aria-label={`Selecionar ${item.name}`}
                            />
                          </td>
                          <td className="px-3 py-2">{item.ca ?? "—"}</td>
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2">{item.size ?? "—"}</td>
                          <td className="px-3 py-2">{item.unitOfMeasure ?? "—"}</td>
                          <td className="px-3 py-2">{item.currentBalance}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={1}
                              max={item.currentBalance}
                              value={selected ? quantities[item.id] : ""}
                              disabled={!selected}
                              onChange={(e) =>
                                setQuantities((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              className={`${inputClass} w-24 disabled:opacity-40`}
                              aria-label={`Quantidade de ${item.name}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelivery}
                disabled={pending}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {pending ? "Registrando…" : "Confirmar entrega"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
