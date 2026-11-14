import { z } from "zod";

import type { CommercialItem } from "./billing-model";
import {
  isFictitiousCatalogAllowedFor,
  type BillingPeriod,
  type CommercialEnvironment,
  type CommercialUnit,
} from "./offer";

export const CHECKOUT_REFERENCE_KEY = "commercialCheckoutId";

export const checkoutInputSchema = z
  .object({
    idempotencyKey: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z0-9_-]{16,100}$/,
        "Informe uma chave de 16 a 100 caracteres (letras, números, hífen ou sublinhado).",
      ),
  })
  .strict();
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export type CheckoutContract = {
  billingPeriod: BillingPeriod;
  fictitious: boolean;
  termEnd: string | null;
  companyCount: number;
  items: readonly CommercialItem[];
  hasOneOffOrder?: boolean;
};
export type CheckoutMode = "payment" | "subscription";

export function checkoutMode(
  contract: Pick<CheckoutContract, "billingPeriod">,
): CheckoutMode {
  return contract.billingPeriod === "one_time" ? "payment" : "subscription";
}
export type ProviderPrice = { position: number; providerPriceId: string };
export type CheckoutLine = {
  position: number;
  providerPriceId: string;
  quantity: number;
};
export type CheckoutClock = { today: string; env: CommercialEnvironment };

const QUANTITY_BY_UNIT: Record<
  CommercialUnit,
  (contract: CheckoutContract) => number | null
> = {
  organization: () => 1,
  company: (contract) =>
    contract.billingPeriod === "one_time" ? 1 : contract.companyCount,
  employee: () => null,
  document: () => null,
};

function draftLines(contract: CheckoutContract, prices: readonly ProviderPrice[]) {
  return contract.items.map((item) => ({
    item,
    quantity: QUANTITY_BY_UNIT[item.unit](contract),
    providerPriceId:
      prices.find((price) => price.position === item.position)?.providerPriceId ?? null,
  }));
}
type DraftLine = ReturnType<typeof draftLines>[number];

const CHECKOUT_RULES: {
  broken: (
    contract: CheckoutContract,
    lines: DraftLine[],
    clock: CheckoutClock,
  ) => boolean;
  message: (lines: DraftLine[]) => string;
}[] = [
  {
    broken: (contract) =>
      contract.billingPeriod === "one_time" &&
      contract.items.some((item) => item.service !== "one_off"),
    message: () => "Contratação avulsa só tem checkout para serviços avulsos (NOB-117).",
  },
  {
    broken: (contract) =>
      contract.billingPeriod === "one_time" && contract.hasOneOffOrder !== true,
    message: () => "Contratação avulsa só é cobrada a partir de um pedido avulso.",
  },
  {
    broken: (contract, _lines, clock) =>
      contract.fictitious && !isFictitiousCatalogAllowedFor(clock.env),
    message: () => "Contratação do catálogo fictício não é cobrada neste ambiente.",
  },
  {
    broken: (contract, _lines, clock) =>
      contract.termEnd !== null && contract.termEnd < clock.today,
    message: () => "A vigência desta contratação já terminou.",
  },
  {
    broken: (_contract, lines) => lines.some((line) => line.quantity === null),
    message: (lines) =>
      `A quantidade cobrada por "${lines.find((line) => line.quantity === null)?.item.label}" depende de regra comercial ainda não aprovada.`,
  },
  {
    broken: (_contract, lines) => lines.some((line) => line.quantity === 0),
    message: () => "A contratação não tem empresa para cobrar.",
  },
  {
    broken: (_contract, lines) => lines.some((line) => line.providerPriceId === null),
    message: (lines) =>
      `O item "${lines.find((line) => line.providerPriceId === null)?.item.label}" não tem preço cadastrado no provedor de pagamento.`,
  },
];

export function checkoutLines(
  contract: CheckoutContract,
  prices: readonly ProviderPrice[],
  clock: CheckoutClock,
): { lines: CheckoutLine[] } | { problem: string } {
  const drafts = draftLines(contract, prices);
  const broken = CHECKOUT_RULES.find((rule) => rule.broken(contract, drafts, clock));
  if (broken) return { problem: broken.message(drafts) };
  return {
    lines: drafts.flatMap(({ item, quantity, providerPriceId }) =>
      quantity === null || providerPriceId === null
        ? []
        : [{ position: item.position, providerPriceId, quantity }],
    ),
  };
}
