"use client";

import { useState, useTransition } from "react";

import { getEmployeeEpiRecordAction } from "@/shared/server/actions/pgr/epi-record";
import {
  EPI_RECORD_STATUSES,
  type EpiRecordRow,
  type EpiRecordStatus,
} from "@/shared/domains/pgr/epi-record";
import type { Paginated } from "@/shared/pagination";
import { EmptyState, Table } from "@/app/(protected)/_ui/list";

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<EpiRecordStatus, string> = {
  todos: "Todos",
  pendente: "Em uso (não devolvido)",
  devolvido: "Devolvido",
};

function formatIsoDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("pt-BR");
}

/**
 * Ficha de EPI do funcionário (US5): tabela somente-leitura com filtros de
 * status/período (client-side via Server Action) e impressão — o `@media print`
 * isola a ficha do resto da página.
 */
export function EpiRecordTable({
  employeeId,
  employeeName,
  initial,
}: {
  employeeId: string;
  employeeName: string;
  initial: Paginated<EpiRecordRow>;
}) {
  const [data, setData] = useState(initial);
  const [status, setStatus] = useState<EpiRecordStatus>("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load(next: {
    status?: EpiRecordStatus;
    from?: string;
    to?: string;
    page?: number;
  }) {
    const query = {
      status: next.status ?? status,
      from: (next.from ?? from) || undefined,
      to: (next.to ?? to) || undefined,
      page: next.page ?? 1,
      pageSize: PAGE_SIZE,
    };
    startTransition(async () => {
      const result = await getEmployeeEpiRecordAction(employeeId, query);
      if (result.ok) {
        setError(null);
        setData(result.data);
        setPage(query.page);
        return;
      }
      setError(result.error.message);
    });
  }

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const inputClass =
    "rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm dark:border-white/15 dark:bg-zinc-900";

  return (
    <div className="epi-record-print flex flex-col gap-3">
      {/* impressão: só a ficha fica visível (título + tabela); filtros/botões somem */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .epi-record-print, .epi-record-print * { visibility: visible; }
          .epi-record-print { position: absolute; inset: 0; padding: 16px; }
          .epi-record-no-print { display: none !important; }
        }
      `}</style>

      <p className="hidden text-sm font-medium print:block">
        Ficha de EPI — {employeeName}
      </p>

      <div className="epi-record-no-print flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Status
          <select
            value={status}
            onChange={(e) => {
              const value = e.target.value as EpiRecordStatus;
              setStatus(value);
              load({ status: value });
            }}
            className={inputClass}
          >
            {EPI_RECORD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          De
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              load({ from: e.target.value });
            }}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Até
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              load({ to: e.target.value });
            }}
            className={inputClass}
          />
        </label>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
        >
          Imprimir
        </button>
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>

      {data.rows.length === 0 ? (
        <EmptyState message="Nenhum registro de EPI para os filtros selecionados." />
      ) : (
        <Table
          headers={[
            "CA",
            "EPI",
            "Tam.",
            "Qtd.",
            "Data de Entrega",
            "Data de Devolução",
            "Assinatura",
          ]}
        >
          {data.rows.map((row) => (
            <tr key={row.itemId} className="border-t border-black/5 dark:border-white/5">
              <td className="px-4 py-2">{row.ca ?? "—"}</td>
              <td className="px-4 py-2">{row.epiName}</td>
              <td className="px-4 py-2">{row.size ?? "—"}</td>
              <td className="px-4 py-2">{row.quantity}</td>
              <td className="px-4 py-2">{formatIsoDate(row.deliveryDate)}</td>
              <td className="px-4 py-2">
                {row.returnedAt
                  ? new Date(row.returnedAt).toLocaleDateString("pt-BR")
                  : "—"}
              </td>
              <td className="px-4 py-2">{row.signatureLabel}</td>
            </tr>
          ))}
        </Table>
      )}

      {totalPages > 1 ? (
        <nav className="epi-record-no-print flex items-center justify-between gap-4 text-sm">
          <span className="text-zinc-500">
            Página {page} de {totalPages} · {data.total} registro(s)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || page <= 1}
              onClick={() => load({ page: page - 1 })}
              className="rounded-md border border-black/15 px-3 py-1 transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={pending || page >= totalPages}
              onClick={() => load({ page: page + 1 })}
              className="rounded-md border border-black/15 px-3 py-1 transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15"
            >
              Próxima
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
