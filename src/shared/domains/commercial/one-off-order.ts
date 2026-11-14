import { z } from "zod";

import { requiredUuid } from "@/shared/domains/pgr/form-fields";

import type { BillingPeriod, CommercialService, OfferScope } from "./offer";

export const oneOffOrderStatusSchema = z.enum(["pending", "paid", "cancelled"]);
export type OneOffOrderStatus = z.infer<typeof oneOffOrderStatusSchema>;

const TRANSITIONS: Record<OneOffOrderStatus, readonly OneOffOrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
};

export function canTransitionOneOffOrder(
  from: OneOffOrderStatus,
  to: OneOffOrderStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export const oneOffOrderInputSchema = z
  .object({
    offerId: requiredUuid("Versão de oferta inválida."),
    companyId: requiredUuid("Empresa inválida."),
  })
  .strict();
export type OneOffOrderInput = z.infer<typeof oneOffOrderInputSchema>;

const pageNumber = z.number().int().positive().optional();

export const oneOffOrderFiltersSchema = z.object({
  page: pageNumber,
  pageSize: pageNumber,
  companyId: requiredUuid("Empresa inválida.").optional(),
  status: oneOffOrderStatusSchema.optional(),
});
export type OneOffOrderFilters = z.infer<typeof oneOffOrderFiltersSchema>;

export const oneOffOrderIdSchema = requiredUuid("Pedido avulso inválido.");

type OneOffOffer = {
  billingPeriod: BillingPeriod;
  scope: OfferScope;
  items: readonly { service: CommercialService }[];
};

const OFFER_RULES: { broken: (offer: OneOffOffer) => boolean; message: string }[] = [
  {
    broken: (offer) => offer.billingPeriod !== "one_time",
    message: "Pedido avulso só vale para oferta de cobrança única.",
  },
  {
    broken: (offer) => offer.items.some((item) => item.service !== "one_off"),
    message: "Pedido avulso só aceita itens de serviço avulso.",
  },
  {
    broken: (offer) => offer.scope !== "company",
    message: "Pedido avulso é sempre de uma empresa.",
  },
];

export function oneOffOfferProblem(offer: OneOffOffer): string | null {
  return OFFER_RULES.find((rule) => rule.broken(offer))?.message ?? null;
}

export function isOneOffPaid(order: { status: OneOffOrderStatus }): boolean {
  return order.status === "paid";
}

export function oneOffCovers(
  order: { status: OneOffOrderStatus; companyId: string },
  companyId: string,
): boolean {
  return isOneOffPaid(order) && order.companyId === companyId;
}
