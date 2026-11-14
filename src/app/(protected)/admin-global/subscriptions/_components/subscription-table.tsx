import Link from "next/link";

import {
  DIVERGENCE_LABELS,
  type AdminSubscriptionRow,
} from "@/shared/domains/commercial/admin-subscriptions";

import { StatusBadge } from "../../../_ui/status-badge";
import { Table } from "../../../_ui/list";
import {
  PERIOD_LABELS,
  STATUS_LABELS,
  describeItem,
  divergenceTone,
  formatInstant,
  formatPeriod,
  statusTone,
} from "./format";

const HEADERS = [
  "Escritório",
  "Oferta",
  "Valor contratado",
  "Status",
  "Período atual",
  "Último evento",
  "Divergência",
];

function SubscriptionRow({ row }: { row: AdminSubscriptionRow }) {
  const href = `/admin-global/subscriptions/${row.contractId}?orgId=${encodeURIComponent(row.orgId)}`;
  return (
    <tr className="align-top">
      <td className="px-4 py-3 font-mono text-xs">{row.orgId}</td>
      <td className="px-4 py-3">
        <Link href={href} className="text-primary font-semibold underline">
          {row.offerName}
        </Link>
        <p className="text-text-subtle text-xs">
          {row.offerCode} · {PERIOD_LABELS[row.billingPeriod] ?? row.billingPeriod}
        </p>
      </td>
      <td className="px-4 py-3">
        <ul className="flex flex-col gap-1">
          {row.items.map((item) => (
            <li key={item.position}>{describeItem(item)}</li>
          ))}
        </ul>
      </td>
      <td className="px-4 py-3">
        <StatusBadge tone={statusTone(row.status)} label={STATUS_LABELS[row.status]} />
        <p className="text-text-subtle mt-1 font-mono text-xs">
          {row.providerSubscriptionId}
        </p>
      </td>
      <td className="px-4 py-3">
        {formatPeriod(row.currentPeriodStart, row.currentPeriodEnd)}
      </td>
      <td className="px-4 py-3">
        {row.lastEvent
          ? `${row.lastEvent.type} (${row.lastEvent.outcome}) · ${formatInstant(row.lastEvent.occurredAt)}`
          : "—"}
      </td>
      <td className="px-4 py-3">
        <StatusBadge
          tone={divergenceTone(row.divergence)}
          label={DIVERGENCE_LABELS[row.divergence]}
        />
      </td>
    </tr>
  );
}

export function SubscriptionTable({ rows }: { rows: AdminSubscriptionRow[] }) {
  return (
    <Table headers={HEADERS} isBare>
      {rows.map((row) => (
        <SubscriptionRow key={row.contractId} row={row} />
      ))}
    </Table>
  );
}
