import { z } from "zod";

import { requiredUuid } from "@/shared/domains/pgr/form-fields";

import {
  civilDateSchema,
  type BillingPeriod,
  type CommercialService,
  type CommercialUnit,
  type OfferQuota,
  type OfferScope,
} from "./offer";

export const customerKindSchema = z.enum(["office", "company"]);
export type CustomerKind = z.infer<typeof customerKindSchema>;

export const customerStatusSchema = z.enum(["active", "inactive"]);
export type CustomerStatus = z.infer<typeof customerStatusSchema>;

const legalNameSchema = z.string().trim().min(2).max(200);
const taxIdSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().regex(/^(\d{11}|\d{14})$/, "Informe um CPF ou CNPJ completo."));
const billingEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Informe um e-mail de cobrança válido.").max(254));

export const customerInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("office"),
      legalName: legalNameSchema,
      taxId: taxIdSchema,
      billingEmail: billingEmailSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("company"),
      companyId: requiredUuid("Empresa inválida."),
      billingEmail: billingEmailSchema,
    })
    .strict(),
]);
export type CustomerInput = z.infer<typeof customerInputSchema>;

export const customerUpdateSchema = z
  .object({
    billingEmail: billingEmailSchema,
    status: customerStatusSchema,
    legalName: legalNameSchema.optional(),
    taxId: taxIdSchema.optional(),
  })
  .strict();
export type CustomerUpdate = z.infer<typeof customerUpdateSchema>;

export const contractInputSchema = z
  .object({
    customerId: requiredUuid("Cliente inválido."),
    offerVersionId: requiredUuid("Versão de oferta inválida."),
    companyIds: z.array(requiredUuid("Empresa inválida.")).max(500),
    termStart: civilDateSchema,
    termEnd: civilDateSchema.nullable(),
  })
  .strict()
  .refine((input) => new Set(input.companyIds).size === input.companyIds.length, {
    path: ["companyIds"],
    message: "Cada empresa aparece uma única vez na contratação.",
  })
  .refine((input) => input.termEnd === null || input.termEnd >= input.termStart, {
    path: ["termEnd"],
    message: "O fim da vigência não pode ser anterior ao início.",
  });
export type ContractInput = z.infer<typeof contractInputSchema>;

type ContractParties = {
  customerKind: CustomerKind;
  customerCompanyId: string | null;
  offerScope: OfferScope;
  companyIds: readonly string[];
};

const COMPANY_RULES: {
  message: string;
  broken: (parties: ContractParties) => boolean;
}[] = [
  {
    message: "Oferta por escritório só pode ser contratada pela própria consultoria.",
    broken: (p) => p.offerScope === "organization" && p.customerKind !== "office",
  },
  {
    message: "Oferta por escritório não lista empresas.",
    broken: (p) => p.offerScope === "organization" && p.companyIds.length > 0,
  },
  {
    message: "Cliente direto contrata só para a própria empresa.",
    broken: (p) =>
      p.offerScope === "company" &&
      p.customerKind === "company" &&
      (p.companyIds.length !== 1 || p.companyIds[0] !== p.customerCompanyId),
  },
  {
    message: "Informe ao menos uma empresa que vai usar o serviço.",
    broken: (p) =>
      p.offerScope === "company" &&
      p.customerKind === "office" &&
      p.companyIds.length === 0,
  },
];

export function contractCompaniesProblem(parties: ContractParties): string | null {
  return COMPANY_RULES.find((rule) => rule.broken(parties))?.message ?? null;
}

export type ContractOffer = {
  id: string;
  code: string;
  version: number;
  name: string;
  scope: OfferScope;
  currency: string;
  billingPeriod: BillingPeriod;
  quotas: OfferQuota[];
  fictitious: boolean;
  items: {
    service: CommercialService;
    label: string;
    unit: CommercialUnit;
    unitAmountCents: number;
  }[];
};

export type ContractPayer = { kind: CustomerKind; legalName: string; taxId: string };

export function contractSnapshot({
  customer,
  offer,
}: {
  customer: ContractPayer;
  offer: ContractOffer;
}) {
  return {
    header: {
      offerVersionId: offer.id,
      customerKind: customer.kind,
      customerLegalName: customer.legalName,
      customerTaxId: customer.taxId,
      offerCode: offer.code,
      offerVersion: offer.version,
      offerName: offer.name,
      offerScope: offer.scope,
      currency: offer.currency,
      billingPeriod: offer.billingPeriod,
      quotas: offer.quotas.map((quota) => ({ ...quota })),
      fictitious: offer.fictitious,
    },
    items: offer.items.map((item, index) => ({
      position: index + 1,
      service: item.service,
      label: item.label,
      unit: item.unit,
      unitAmountCents: item.unitAmountCents,
    })),
  };
}
export type ContractSnapshot = ReturnType<typeof contractSnapshot>;
