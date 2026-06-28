"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  createDeliveryAction,
  signDeliveryManualAction,
} from "@/shared/server/actions/pgr/epi-deliveries";
import type { DeliveryResult } from "@/shared/domains/pgr/epi-deliveries";
import type { EpiStockListItem } from "@/shared/domains/pgr/epi-stock";

import { FormError } from "../../../../_ui/form";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputClass =
  "rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:bg-zinc-900";

type Step = "select" | "review";

/**
 * Wizard de entrega (3 passos): seleção (saldo > 0) → revisão → assinatura manual.
 * A confirmação cria a entrega pendente e, em seguida, assina manual (baixa transacional).
 * QR Code / Enviar Link entram nas fatias US2/US3.
 */
export function DeliveryWizard({
  employeeId,
  employeeName,
  stockItems,
}: {
  employeeId: string;
  employeeName: string;
  stockItems: EpiStockListItem[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("select");
  const [deliveryDate, setDeliveryDate] = useState(todayIso());
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<DeliveryResult | null>(null);
  const [pending, startTransition] = useTransition();

  // Itens selecionados COM quantidade válida (> 0 e <= saldo).
  const chosen = useMemo(
    () =>
      stockItems
        .filter((s) => selected[s.id])
        .map((s) => ({ stock: s, quantity: Number(quantities[s.id] ?? "") }))
        .filter((c) => Number.isInteger(c.quantity) && c.quantity > 0),
    [stockItems, selected, quantities],
  );

  const overBalance = chosen.filter((c) => c.quantity > c.stock.currentBalance);
  const canReview = chosen.length > 0 && overBalance.length === 0;

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function setQty(id: string, value: string) {
    setQuantities((prev) => ({ ...prev, [id]: value }));
  }

  function confirmManual() {
    setFormError(null);
    startTransition(async () => {
      const created = await createDeliveryAction({
        employeeId,
        deliveryDate,
        items: chosen.map((c) => ({ stockId: c.stock.id, quantity: String(c.quantity) })),
      });
      if (!created.ok) {
        setFormError(created.error.message);
        return;
      }
      const signed = await signDeliveryManualAction(created.data.deliveryId);
      if (!signed.ok) {
        setFormError(signed.error.message);
        return;
      }
      setResult(signed.data);
      router.refresh();
    });
  }

  // ---- Sucesso ----
  if (result) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-green-300 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950/30">
        <h2 className="text-lg font-semibold text-green-800 dark:text-green-300">
          Entrega registrada e assinada (manual)
        </h2>
        <p className="text-sm text-green-700 dark:text-green-400">
          O estoque foi baixado para {employeeName}.
        </p>
        {result.lowStockWarnings.length > 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            <p className="font-medium">Atenção: itens abaixo da quantidade mínima</p>
            <ul className="mt-1 list-inside list-disc">
              {result.lowStockWarnings.map((w) => (
                <li key={w.stockId}>
                  {w.name}: saldo {w.balance} (mínima {w.minQuantity})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex gap-3">
          <Link
            href={`/employees/${employeeId}`}
            className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
          >
            Voltar ao funcionário
          </Link>
          <Link
            href={`/employees/${employeeId}/epi-delivery`}
            className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 dark:bg-white dark:text-black"
          >
            Nova entrega
          </Link>
        </div>
      </div>
    );
  }

  // ---- Passo 2: revisão + assinatura manual ----
  if (step === "review") {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <h2 className="text-lg font-semibold">Revisar entrega</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Funcionário: <span className="font-medium">{employeeName}</span> · Data:{" "}
            <span className="font-medium">{deliveryDate}</span>
          </p>
          <ul className="mt-3 divide-y divide-black/5 dark:divide-white/5">
            {chosen.map((c) => (
              <li key={c.stock.id} className="flex justify-between py-2 text-sm">
                <span>
                  {c.stock.name}
                  {c.stock.ca ? ` (CA ${c.stock.ca})` : ""}
                </span>
                <span className="font-medium">
                  {c.quantity} {c.stock.unitOfMeasure ?? "un"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <FormError message={formError} />

        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Assinatura manual: confirme que o funcionário recebeu e assinou presencialmente.
          O estoque é baixado neste momento.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setStep("select")}
            disabled={pending}
            className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={confirmManual}
            disabled={pending}
            className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {pending ? "Registrando…" : "Confirmar entrega (assinatura manual)"}
          </button>
        </div>
      </div>
    );
  }

  // ---- Passo 1: seleção ----
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Data da entrega *</span>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-black/3 text-left dark:bg-white/5">
            <tr>
              <th className="px-4 py-2 font-medium">Entregar</th>
              <th className="px-4 py-2 font-medium">EPI</th>
              <th className="px-4 py-2 font-medium">CA</th>
              <th className="px-4 py-2 font-medium">Saldo</th>
              <th className="px-4 py-2 font-medium">Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {stockItems.map((s) => {
              const isOn = !!selected[s.id];
              const qty = Number(quantities[s.id] ?? "");
              const invalid = isOn && qty > 0 && qty > s.currentBalance;
              return (
                <tr key={s.id} className="border-t border-black/5 dark:border-white/5">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => toggle(s.id)}
                      aria-label={`Entregar ${s.name}`}
                    />
                  </td>
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2">{s.ca ?? "—"}</td>
                  <td className="px-4 py-2">
                    {s.currentBalance} {s.unitOfMeasure ?? "un"}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={1}
                      max={s.currentBalance}
                      disabled={!isOn}
                      value={quantities[s.id] ?? ""}
                      onChange={(e) => setQty(s.id, e.target.value)}
                      className={`${inputClass} w-24 disabled:opacity-50 ${
                        invalid ? "border-red-500" : ""
                      }`}
                    />
                    {invalid ? (
                      <span className="ml-2 text-xs text-red-600">acima do saldo</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-zinc-500">
          {chosen.length} item(ns) selecionado(s)
        </span>
        <button
          type="button"
          onClick={() => setStep("review")}
          disabled={!canReview}
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Próximo: revisar
        </button>
      </div>
    </div>
  );
}
