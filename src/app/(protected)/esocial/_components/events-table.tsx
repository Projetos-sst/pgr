"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { EventListItem } from "@/shared/domains/esocial/events";
import {
  generateReportAction,
  queryBatchReturnAction,
  sendBatchAction,
} from "@/shared/server/actions/esocial/events";

type BatchRow = {
  id: string;
  protocolNumber: string | null;
  status: string;
  createdAt: string;
};

export function EventsTable({
  events,
  batches,
}: {
  events: EventListItem[];
  batches: BatchRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);

  const selectablePending = events.filter((e) => e.status === "pending");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSend() {
    if (selected.size === 0) return;
    startTransition(async () => {
      const r = await sendBatchAction([...selected]);
      if (r.ok) {
        setMessage(
          `Lote enviado · protocolo ${r.data.protocolNumber} (${r.data.count} evento(s)).`,
        );
        setError(null);
        setSelected(new Set());
        router.refresh();
      } else {
        setError(r.error.message);
      }
    });
  }

  function onQuery(batchId: string) {
    startTransition(async () => {
      const r = await queryBatchReturnAction(batchId);
      if (r.ok) {
        setMessage(`Retorno consultado · ${r.data.updated} evento(s) atualizado(s).`);
        setError(null);
        router.refresh();
      } else {
        setError(r.error.message);
      }
    });
  }

  function onReport() {
    startTransition(async () => {
      const r = await generateReportAction({});
      if (r.ok) setReport(r.data.report);
      else setError(r.error.message);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || selected.size === 0}
          onClick={onSend}
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          Enviar selecionados ({selected.size})
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onReport}
          className="rounded-md border border-black/15 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/15"
        >
          Gerar relatório
        </button>
      </div>

      {message ? (
        <p className="text-sm text-green-700 dark:text-green-400">{message}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-black/3 text-left dark:bg-white/5">
            <tr>
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Criado</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                  Nenhum evento eSocial.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="border-t border-black/5 dark:border-white/5">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      disabled={e.status !== "pending"}
                      checked={selected.has(e.id)}
                      onChange={() => toggle(e.id)}
                    />
                  </td>
                  <td className="px-3 py-2">{e.eventTypeLabel}</td>
                  <td className="px-3 py-2">{e.statusLabel}</td>
                  <td className="px-3 py-2 tabular-nums">{e.createdAt.slice(0, 10)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/esocial/detalhe/${e.id}`}
                      className="rounded-md border border-black/15 px-3 py-1 text-sm hover:bg-black/5 dark:border-white/15"
                    >
                      Detalhe
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        {selectablePending.length} evento(s) pendente(s) selecionável(is).
      </p>

      {batches.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Lotes enviados</h2>
          <ul className="flex flex-col gap-2">
            {batches.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/10 p-3 dark:border-white/10"
              >
                <span className="text-sm">
                  {b.protocolNumber ?? "—"} · {b.status}
                </span>
                {b.status === "sent" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onQuery(b.id)}
                    className="rounded-md border border-black/15 px-3 py-1 text-sm disabled:opacity-50 dark:border-white/15"
                  >
                    Consultar retorno
                  </button>
                ) : (
                  <span className="text-xs text-zinc-500">processado</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report ? (
        <pre className="max-h-80 overflow-auto rounded-md border border-black/10 bg-black/3 p-3 text-xs dark:border-white/10 dark:bg-white/5">
          {report}
        </pre>
      ) : null}
    </div>
  );
}
