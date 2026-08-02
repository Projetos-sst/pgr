"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { EventListItem } from "@/shared/domains/esocial/events";
import {
  generateReportAction,
  queryBatchReturnAction,
  sendBatchAction,
} from "@/shared/server/actions/esocial/events";

import {
  Cell,
  DataGrid,
  EditIconLink,
  GridHeader,
  GridRow,
  ListCard,
  StatusBadge,
  type StatusTone,
} from "../../_ui/data-list";

type BatchRow = {
  id: string;
  protocolNumber: string | null;
  status: string;
  createdAt: string;
};

const TEMPLATE = "44px 2fr 1.2fr 1fr 84px";

const STATUS_TONE: Record<string, StatusTone> = {
  draft: "neutral",
  pending: "amber",
  sent: "indigo",
  accepted: "green",
  rejected: "red",
  error: "red",
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
          className="btn-primary flex h-11 items-center rounded-xl px-4 text-[13px] font-bold transition-colors disabled:opacity-40"
        >
          Enviar selecionados ({selected.size})
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onReport}
          className="text-text-muted hover:text-text h-11 rounded-xl border border-white/70 bg-white/50 px-4 text-[13px] font-semibold transition-colors disabled:opacity-50"
        >
          Gerar relatório
        </button>
      </div>

      {message ? <p className="text-sm text-[#0e9f6e]">{message}</p> : null}
      {error ? <p className="text-sm text-[#d33a3f]">{error}</p> : null}

      <ListCard>
        {events.length === 0 ? (
          <p className="text-text-subtle px-6 py-12 text-center text-sm">
            Nenhum evento eSocial.
          </p>
        ) : (
          <DataGrid minWidth={720}>
            <GridHeader
              template={TEMPLATE}
              columns={[
                { header: "" },
                { header: "Evento" },
                { header: "Status" },
                { header: "Criado" },
                { header: "Opções", align: "right" },
              ]}
            />
            {events.map((e, i) => (
              <GridRow key={e.id} template={TEMPLATE} striped={i % 2 === 1}>
                <Cell>
                  <input
                    type="checkbox"
                    aria-label="Selecionar evento"
                    disabled={e.status !== "pending"}
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                    className="accent-primary size-4"
                  />
                </Cell>
                <Cell className="text-text font-semibold">{e.eventTypeLabel}</Cell>
                <Cell>
                  <StatusBadge tone={STATUS_TONE[e.status] ?? "neutral"}>
                    {e.statusLabel}
                  </StatusBadge>
                </Cell>
                <Cell className="text-text-muted font-mono">
                  {e.createdAt.slice(0, 10)}
                </Cell>
                <Cell align="right">
                  <span className="flex justify-end">
                    <EditIconLink href={`/esocial/detail/${e.id}`} />
                  </span>
                </Cell>
              </GridRow>
            ))}
          </DataGrid>
        )}
      </ListCard>

      <p className="text-text-subtle text-xs">
        {selectablePending.length} evento(s) pendente(s) selecionável(is).
      </p>

      {batches.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-text text-sm font-bold">Lotes enviados</h2>
          <ul className="flex flex-col gap-2">
            {batches.map((b) => (
              <li
                key={b.id}
                className="glass-card flex flex-wrap items-center justify-between gap-2 rounded-[14px] p-3.5"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span className="text-primary font-mono font-semibold">
                    {b.protocolNumber ?? "—"}
                  </span>
                  <span className="text-text-subtle">· {b.status}</span>
                </span>
                {b.status === "sent" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onQuery(b.id)}
                    className="text-text-muted hover:text-text rounded-xl border border-white/70 bg-white/50 px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50"
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
        <pre className="glass-card max-h-80 overflow-auto rounded-[14px] p-4 text-xs">
          {report}
        </pre>
      ) : null}
    </div>
  );
}
