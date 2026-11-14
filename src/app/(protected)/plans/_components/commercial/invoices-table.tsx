import Link from "next/link";

import type { InvoiceStatus } from "@/shared/domains/commercial/billing-model";
import {
  INVOICE_STATUS_LABEL,
  invoiceBreakdown,
} from "@/shared/domains/commercial/subscription-sheet";
import type { listInvoices } from "@/shared/server/commercial/invoices-core";

import { StatusBadge, type StatusTone } from "../../../_ui/status-badge";
import { formatBrl } from "./format";
import { formatInstant } from "./sheet-format";

export type InvoiceRow = Awaited<ReturnType<typeof listInvoices>>["rows"][number];

const PAGE_SIZE = 20;
const EMPTY_MESSAGE = "Nenhuma fatura espelhada do provedor até o momento.";

const STATUS_TONE: Record<InvoiceStatus, StatusTone> = {
  open: "amber",
  paid: "green",
  void: "neutral",
  uncollectible: "red",
};

function Breakdown({ totals }: { totals: InvoiceRow["totalsByService"] }) {
  return (
    <ul aria-label="Detalhamento por serviço" className="flex flex-col gap-0.5 text-xs">
      {invoiceBreakdown(totals).map((row) => (
        <li key={row.key}>
          {row.label}: {formatBrl(row.cents)}
        </li>
      ))}
    </ul>
  );
}

function InvoiceLine({ invoice }: { invoice: InvoiceRow }) {
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-3 py-3 font-bold">{formatBrl(invoice.totalCents)}</td>
      <td className="px-3 py-3 uppercase">{invoice.currency}</td>
      <td className="px-3 py-3">
        {formatInstant(invoice.periodStart)} a {formatInstant(invoice.periodEnd)}
      </td>
      <td className="px-3 py-3">{formatInstant(invoice.dueAt)}</td>
      <td className="px-3 py-3">
        <StatusBadge
          tone={STATUS_TONE[invoice.status]}
          label={INVOICE_STATUS_LABEL[invoice.status]}
        />
      </td>
      <td className="px-3 py-3">
        <Breakdown totals={invoice.totalsByService} />
      </td>
    </tr>
  );
}

function Pagination({ page, total }: { page: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <nav aria-label="Paginação de faturas" className="flex items-center gap-4 text-xs">
      {page > 1 ? <Link href={`/plans/invoices?page=${page - 1}`}>Anterior</Link> : null}
      <span>
        Página {page} de {pages}
      </span>
      {page < pages ? (
        <Link href={`/plans/invoices?page=${page + 1}`}>Próxima</Link>
      ) : null}
    </nav>
  );
}

export function InvoicesTable({
  rows,
  total,
  page,
}: {
  rows: InvoiceRow[];
  total: number;
  page: number;
}) {
  if (rows.length === 0)
    return (
      <p role="status" className="text-text-muted text-sm">
        {EMPTY_MESSAGE}
      </p>
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="glass-panel overflow-x-auto rounded-2xl">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="text-text-muted font-bold uppercase">
            <tr>
              <th className="px-3 py-3">Total</th>
              <th className="px-3 py-3">Moeda</th>
              <th className="px-3 py-3">Competência</th>
              <th className="px-3 py-3">Vencimento</th>
              <th className="px-3 py-3">Situação</th>
              <th className="px-3 py-3">Detalhamento</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((invoice) => (
              <InvoiceLine key={invoice.id} invoice={invoice} />
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} />
    </div>
  );
}
