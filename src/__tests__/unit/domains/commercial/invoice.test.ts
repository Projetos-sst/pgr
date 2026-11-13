import {
  applyInvoiceSnapshot,
  classifyInvoiceLines,
  totalsByService,
  withUndetailedRemainder,
  type InvoiceLine,
  type InvoiceMirrorState,
  type PriceService,
} from "@/shared/domains/commercial/invoice";

const line = (overrides: Partial<InvoiceLine> = {}): InvoiceLine => ({
  providerPriceId: "price_pgr",
  label: "PGR por empresa",
  quantity: 1,
  amountCents: 11100,
  ...overrides,
});
const prices: PriceService[] = [
  { providerPriceId: "price_pgr", service: "pgr" },
  { providerPriceId: "price_med", service: "medicine" },
  { providerPriceId: "price_pro", service: "pro" },
];
const at = (iso: string) => new Date(iso);

describe("itens da fatura por serviço", () => {
  it("classifica cada linha pelo preço do provedor mapeado no catálogo e numera na ordem recebida", () => {
    expect(
      classifyInvoiceLines(
        [
          line(),
          line({
            providerPriceId: "price_med",
            label: "Medicina por empresa",
            quantity: 2,
            amountCents: 44400,
          }),
        ],
        prices,
      ),
    ).toEqual([
      {
        position: 1,
        service: "pgr",
        label: "PGR por empresa",
        quantity: 1,
        amountCents: 11100,
        providerPriceId: "price_pgr",
      },
      {
        position: 2,
        service: "medicine",
        label: "Medicina por empresa",
        quantity: 2,
        amountCents: 44400,
        providerPriceId: "price_med",
      },
    ]);
  });

  it("linha sem preço conhecido fica como não classificada, nunca somada a PGR ou Medicina", () => {
    const items = classifyInvoiceLines(
      [
        line({ providerPriceId: null, label: "Ajuste", amountCents: -500 }),
        line({ providerPriceId: "price_other" }),
      ],
      prices,
    );
    expect(items.map((item) => item.service)).toEqual(["unclassified", "unclassified"]);
  });

  it("soma os valores separados por serviço, incluindo crédito negativo", () => {
    const items = classifyInvoiceLines(
      [
        line(),
        line({ amountCents: 11100 }),
        line({ providerPriceId: "price_med", amountCents: 22200 }),
        line({ providerPriceId: null, amountCents: -300 }),
      ],
      prices,
    );
    expect(totalsByService(items)).toEqual({
      pgr: 22200,
      medicine: 22200,
      pro: 0,
      one_off: 0,
      unclassified: -300,
    });
  });

  it("fatura só de PGR não tem valor de Medicina e vice-versa", () => {
    expect(totalsByService(classifyInvoiceLines([line()], prices))).toMatchObject({
      pgr: 11100,
      medicine: 0,
    });
    expect(
      totalsByService(
        classifyInvoiceLines([line({ providerPriceId: "price_med" })], prices),
      ),
    ).toMatchObject({ pgr: 0, medicine: 11100 });
  });
});

describe("diferença entre as linhas e o total da fatura", () => {
  it("total igual à soma das linhas não cria linha extra", () => {
    expect(withUndetailedRemainder([line()], 11100)).toEqual([line()]);
  });

  it("imposto, crédito ou linha que o provedor não enviou viram uma linha não discriminada, e os valores por serviço fecham com o total", () => {
    const lines = withUndetailedRemainder(
      [line(), line({ providerPriceId: "price_med", amountCents: 22200 })],
      34000,
    );
    expect(lines[2]).toEqual({
      providerPriceId: null,
      label: "Valor não discriminado pelo provedor",
      quantity: 1,
      amountCents: 700,
    });
    const totals = totalsByService(classifyInvoiceLines(lines, prices));
    expect(totals).toMatchObject({ pgr: 11100, medicine: 22200, unclassified: 700 });
    expect(Object.values(totals).reduce((sum, value) => sum + value, 0)).toBe(34000);
  });
});

describe("aplicação de um evento de fatura ao espelho", () => {
  const current: InvoiceMirrorState = {
    status: "open",
    lastEventAt: at("2026-11-10T12:00:00Z"),
  };

  it("primeiro evento e evento mais novo são aplicados", () => {
    expect(applyInvoiceSnapshot(null, "open", at("2026-11-10T12:00:00Z"))).toBe(
      "applied",
    );
    expect(applyInvoiceSnapshot(current, "paid", at("2026-11-11T12:00:00Z"))).toBe(
      "applied",
    );
  });

  it("evento mais antigo é descartado", () => {
    expect(applyInvoiceSnapshot(current, "paid", at("2026-11-10T11:59:59Z"))).toBe(
      "stale",
    );
  });

  it("fatura paga ou anulada não volta a aberta, nem no mesmo segundo", () => {
    const sameSecond = at("2026-11-10T12:00:00Z");
    expect(applyInvoiceSnapshot({ ...current, status: "paid" }, "open", sameSecond)).toBe(
      "stale",
    );
    expect(applyInvoiceSnapshot({ ...current, status: "void" }, "open", sameSecond)).toBe(
      "stale",
    );
    expect(
      applyInvoiceSnapshot({ ...current, status: "uncollectible" }, "paid", sameSecond),
    ).toBe("applied");
  });
});
