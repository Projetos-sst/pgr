"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { EventListItem } from "@/shared/domains/esocial/events";
import { ViewRowAction } from "../../_ui/row-actions";
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
          className="btn-primary rounded-pill px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Enviar selecionados ({selected.size})
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onReport}
          className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          Gerar relatório
        </button>
      </div>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="glass-card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-white/50 text-left">
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
                <td colSpan={5} className="text-text-subtle px-3 py-6 text-center">
                  Nenhum evento eSocial.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="border-t border-white/50">
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
                    <ViewRowAction href={`/esocial/detail/${e.id}`} label="Detalhe" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-text-subtle text-xs">
        {selectablePending.length} evento(s) pendente(s) selecionável(is).
      </p>

      {batches.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Lotes enviados</h2>
          <ul className="flex flex-col gap-2">
            {batches.map((b) => (
              <li
                key={b.id}
                className="glass-card flex flex-wrap items-center justify-between gap-2 p-3"
              >
                <span className="text-sm">
                  {b.protocolNumber ?? "—"} · {b.status}
                </span>
                {b.status === "sent" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onQuery(b.id)}
                    className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    Consultar retorno
                  </button>
                ) : (
                  <span className="text-text-subtle text-xs">processado</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report ? (
        <pre className="glass-card max-h-80 overflow-auto p-3 text-xs">{report}</pre>
      ) : null}
    </div>
  );
}
