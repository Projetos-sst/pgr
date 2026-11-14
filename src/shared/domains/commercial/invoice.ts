import type { InvoiceItemService, InvoiceStatus } from "./billing-model";
import type { CommercialService } from "./offer";

export type InvoiceLine = {
  providerPriceId: string | null;
  label: string;
  quantity: number;
  amountCents: number;
};
export type PriceService = { providerPriceId: string; service: CommercialService };
export type InvoiceItem = InvoiceLine & { position: number; service: InvoiceItemService };
export type ServiceTotals = Record<InvoiceItemService, number>;
export type InvoiceMirrorState = { status: InvoiceStatus; lastEventAt: Date };

export const UNDETAILED_LINE_LABEL = "Valor não discriminado pelo provedor";

export function withUndetailedRemainder(
  lines: InvoiceLine[],
  totalCents: number,
): InvoiceLine[] {
  const remainder = totalCents - lines.reduce((sum, line) => sum + line.amountCents, 0);
  if (remainder === 0) return lines;
  return [
    ...lines,
    {
      providerPriceId: null,
      label: UNDETAILED_LINE_LABEL,
      quantity: 1,
      amountCents: remainder,
    },
  ];
}

export function classifyInvoiceLines(
  lines: InvoiceLine[],
  prices: PriceService[],
): InvoiceItem[] {
  const serviceByPrice = new Map(
    prices.map((price) => [price.providerPriceId, price.service]),
  );
  return lines.map((line, index) => ({
    ...line,
    position: index + 1,
    service: serviceByPrice.get(line.providerPriceId ?? "") ?? "unclassified",
  }));
}

export function totalsByService(
  items: Pick<InvoiceItem, "service" | "amountCents">[],
): ServiceTotals {
  const totals: ServiceTotals = {
    pgr: 0,
    medicine: 0,
    pro: 0,
    one_off: 0,
    unclassified: 0,
  };
  for (const item of items) totals[item.service] += item.amountCents;
  return totals;
}

const SETTLED: ReadonlySet<InvoiceStatus> = new Set(["paid", "void"]);

export function applyInvoiceSnapshot(
  current: InvoiceMirrorState | null,
  status: InvoiceStatus,
  occurredAt: Date,
): "applied" | "stale" {
  if (!current) return "applied";
  const older = occurredAt < current.lastEventAt;
  const reopens = status !== current.status && SETTLED.has(current.status);
  return older || reopens ? "stale" : "applied";
}
