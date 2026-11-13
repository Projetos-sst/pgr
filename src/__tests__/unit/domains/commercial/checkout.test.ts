import {
  checkoutInputSchema,
  checkoutLines,
  type CheckoutContract,
} from "@/shared/domains/commercial/checkout";
import type { CommercialItem } from "@/shared/domains/commercial/billing-model";

const item = (
  position: number,
  overrides: Partial<CommercialItem> = {},
): CommercialItem => ({
  position,
  service: "pgr",
  label: `Item ${position}`,
  unit: "company",
  unitAmountCents: 1000,
  ...overrides,
});
const contract = (overrides: Partial<CheckoutContract> = {}): CheckoutContract => ({
  billingPeriod: "monthly",
  fictitious: true,
  termEnd: null,
  companyCount: 3,
  items: [item(1), item(2, { service: "pro", unit: "organization" })],
  ...overrides,
});
const prices = [
  { position: 1, providerPriceId: "price_a" },
  { position: 2, providerPriceId: "price_b" },
];
const clock = { today: "2026-11-13", env: { APP_ENV: "local" } };

describe("linhas do checkout", () => {
  it("usa o preço do provedor de cada item e a quantidade pela unidade", () => {
    expect(checkoutLines(contract(), prices, clock)).toEqual({
      lines: [
        { position: 1, providerPriceId: "price_a", quantity: 3 },
        { position: 2, providerPriceId: "price_b", quantity: 1 },
      ],
    });
  });

  it.each([
    ["avulsa", contract({ billingPeriod: "one_time" }), prices, clock, "NOB-117"],
    [
      "fictícia em produção",
      contract(),
      prices,
      { ...clock, env: { APP_ENV: "production" } },
      "fictício",
    ],
    [
      "fictícia sem ambiente declarado",
      contract(),
      prices,
      { ...clock, env: {} },
      "fictício",
    ],
    ["vencida", contract({ termEnd: "2026-11-12" }), prices, clock, "vigência"],
    [
      "por funcionário",
      contract({ items: [item(1, { unit: "employee", label: "Por vida" })] }),
      prices,
      clock,
      '"Por vida"',
    ],
    [
      "por documento",
      contract({ items: [item(1, { unit: "document", label: "Por laudo" })] }),
      prices,
      clock,
      '"Por laudo"',
    ],
    ["sem empresa", contract({ companyCount: 0 }), prices, clock, "empresa"],
    ["sem preço mapeado", contract(), [prices[0]], clock, '"Item 2"'],
    ["sem nenhum preço", contract(), [], clock, '"Item 1"'],
  ])("recusa contratação %s", (_name, input, mapped, at, fragment) => {
    const result = checkoutLines(input, mapped, at);
    expect(result).toEqual({ problem: expect.stringContaining(fragment) });
  });

  it("aceita contratação real em produção e vigência que termina hoje", () => {
    const result = checkoutLines(
      contract({ fictitious: false, termEnd: "2026-11-13" }),
      prices,
      { ...clock, env: { APP_ENV: "production" } },
    );
    expect(result).toHaveProperty("lines");
  });
});

describe("entrada do checkout", () => {
  it("aceita só a chave de idempotência", () => {
    expect(checkoutInputSchema.parse({ idempotencyKey: " abcDEF_123-456789 " })).toEqual({
      idempotencyKey: "abcDEF_123-456789",
    });
  });

  it.each([
    {},
    { idempotencyKey: "curta" },
    { idempotencyKey: "com espaço no meio 123" },
    { idempotencyKey: "a".repeat(101) },
    { idempotencyKey: "abcdefghijklmnop", amountCents: 1 },
    { idempotencyKey: "abcdefghijklmnop", successUrl: "https://evil.test" },
  ])("recusa %j", (input) => {
    expect(checkoutInputSchema.safeParse(input).success).toBe(false);
  });
});
