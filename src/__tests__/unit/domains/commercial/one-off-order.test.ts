import type { CommercialItem } from "@/shared/domains/commercial/billing-model";
import {
  checkoutLines,
  checkoutMode,
  type CheckoutContract,
} from "@/shared/domains/commercial/checkout";
import {
  canTransitionOneOffOrder,
  isOneOffPaid,
  oneOffCovers,
  oneOffOfferProblem,
  oneOffOrderFiltersSchema,
  oneOffOrderInputSchema,
} from "@/shared/domains/commercial/one-off-order";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const item = (overrides: Partial<CommercialItem> = {}): CommercialItem => ({
  position: 1,
  service: "one_off",
  label: "Laudo avulso",
  unit: "company",
  unitAmountCents: 1000,
  ...overrides,
});
const contract = (overrides: Partial<CheckoutContract> = {}): CheckoutContract => ({
  billingPeriod: "one_time",
  fictitious: true,
  termEnd: null,
  companyCount: 1,
  items: [item()],
  hasOneOffOrder: true,
  ...overrides,
});
const prices = [{ position: 1, providerPriceId: "price_a" }];
const clock = { today: "2026-11-13", env: { APP_ENV: "local" } };

describe("checkout de contratação avulsa", () => {
  it("aceita item avulso de unidade fixa com quantidade 1 e modo de pagamento único", () => {
    expect(checkoutLines(contract(), prices, clock)).toEqual({
      lines: [{ position: 1, providerPriceId: "price_a", quantity: 1 }],
    });
    expect(checkoutMode(contract())).toBe("payment");
    expect(checkoutMode(contract({ billingPeriod: "monthly" }))).toBe("subscription");
  });

  it("aceita unidade por escritório e cobra uma vez mesmo com mais de uma empresa no contrato", () => {
    const result = checkoutLines(
      contract({ companyCount: 3, items: [item({ unit: "organization" })] }),
      prices,
      clock,
    );
    expect(result).toEqual({
      lines: [{ position: 1, providerPriceId: "price_a", quantity: 1 }],
    });
    expect(checkoutLines(contract({ companyCount: 3 }), prices, clock)).toEqual({
      lines: [{ position: 1, providerPriceId: "price_a", quantity: 1 }],
    });
  });

  it.each([
    [
      "serviço que não é avulso",
      contract({ items: [item({ service: "pgr" })] }),
      "NOB-117",
    ],
    ["sem pedido avulso", contract({ hasOneOffOrder: false }), "pedido avulso"],
    [
      "sem informação de pedido",
      contract({ hasOneOffOrder: undefined }),
      "pedido avulso",
    ],
    [
      "por funcionário",
      contract({ items: [item({ unit: "employee", label: "Por vida" })] }),
      '"Por vida"',
    ],
    [
      "por documento",
      contract({ items: [item({ unit: "document", label: "Por laudo" })] }),
      '"Por laudo"',
    ],
  ])("recusa contratação avulsa %s", (_name, input, fragment) => {
    expect(checkoutLines(input, prices, clock)).toEqual({
      problem: expect.stringContaining(fragment),
    });
  });

  it("recusa avulsa sem preço no provedor", () => {
    expect(checkoutLines(contract(), [], clock)).toEqual({
      problem: expect.stringContaining('"Laudo avulso"'),
    });
  });

  it("não muda a assinatura recorrente: empresas do contrato continuam multiplicando", () => {
    expect(
      checkoutLines(
        contract({
          billingPeriod: "monthly",
          companyCount: 3,
          hasOneOffOrder: undefined,
          items: [item({ service: "pgr" })],
        }),
        prices,
        clock,
      ),
    ).toEqual({ lines: [{ position: 1, providerPriceId: "price_a", quantity: 3 }] });
  });
});

describe("estados do pedido avulso", () => {
  it("só o pedido pendente muda de estado", () => {
    expect(canTransitionOneOffOrder("pending", "paid")).toBe(true);
    expect(canTransitionOneOffOrder("pending", "cancelled")).toBe(true);
    expect(canTransitionOneOffOrder("paid", "pending")).toBe(false);
    expect(canTransitionOneOffOrder("paid", "cancelled")).toBe(false);
    expect(canTransitionOneOffOrder("cancelled", "paid")).toBe(false);
  });

  it("só o pedido pago da própria empresa autoriza", () => {
    expect(isOneOffPaid({ status: "paid" })).toBe(true);
    expect(isOneOffPaid({ status: "pending" })).toBe(false);
    expect(oneOffCovers({ status: "paid", companyId: COMPANY }, COMPANY)).toBe(true);
    expect(oneOffCovers({ status: "paid", companyId: COMPANY }, OTHER)).toBe(false);
    expect(oneOffCovers({ status: "pending", companyId: COMPANY }, COMPANY)).toBe(false);
    expect(oneOffCovers({ status: "cancelled", companyId: COMPANY }, COMPANY)).toBe(
      false,
    );
  });
});

describe("oferta e entrada do pedido avulso", () => {
  type OfferArg = Parameters<typeof oneOffOfferProblem>[0];
  const offer = (overrides: Partial<OfferArg> = {}): OfferArg => ({
    billingPeriod: "one_time",
    scope: "company",
    items: [{ service: "one_off" }],
    ...overrides,
  });

  it("aceita oferta única, por empresa e só com itens avulsos", () => {
    expect(oneOffOfferProblem(offer())).toBeNull();
  });

  const refused: [string, Partial<OfferArg>][] = [
    ["mensal", { billingPeriod: "monthly" }],
    ["com item recorrente", { items: [{ service: "one_off" }, { service: "pgr" }] }],
    ["por escritório", { scope: "organization" }],
  ];
  it.each(refused)("recusa oferta %s", (_name, overrides) => {
    expect(oneOffOfferProblem(offer(overrides))).toEqual(expect.any(String));
  });

  it("a entrada só traz oferta e empresa", () => {
    expect(
      oneOffOrderInputSchema.safeParse({ offerId: OTHER, companyId: COMPANY }).success,
    ).toBe(true);
    for (const input of [
      {},
      { offerId: OTHER },
      { offerId: OTHER, companyId: COMPANY, amountCents: 1 },
      { offerId: "x", companyId: COMPANY },
    ])
      expect(oneOffOrderInputSchema.safeParse(input).success).toBe(false);
  });

  it("os filtros aceitam empresa e estado válidos", () => {
    expect(
      oneOffOrderFiltersSchema.safeParse({ companyId: COMPANY, status: "paid" }).success,
    ).toBe(true);
    expect(oneOffOrderFiltersSchema.safeParse({ status: "refunded" }).success).toBe(
      false,
    );
  });
});
