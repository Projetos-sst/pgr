import type { OfferVersionInput } from "./offer";

const FICTITIOUS_VALID_FROM = "2026-01-01";

const fictitiousOffer = (
  offer: Pick<
    OfferVersionInput,
    "code" | "name" | "scope" | "billingPeriod" | "items" | "quotas"
  >,
): OfferVersionInput => ({
  ...offer,
  description:
    "Oferta fictícia para validar o fluxo comercial. Valores, cotas e periodicidade não foram aprovados.",
  currency: "BRL",
  validFrom: FICTITIOUS_VALID_FROM,
  validUntil: null,
  fictitious: true,
  approvalReference: null,
});

export const FICTITIOUS_CATALOG: OfferVersionInput[] = [
  fictitiousOffer({
    code: "ficticio-pgr",
    name: "PGR (catálogo fictício de teste)",
    scope: "company",
    billingPeriod: "monthly",
    items: [
      {
        service: "pgr",
        label: "PGR por empresa (fictício)",
        unit: "company",
        unitAmountCents: 11111,
      },
    ],
    quotas: [{ metric: "employees", limit: 111 }],
  }),
  fictitiousOffer({
    code: "ficticio-medicina",
    name: "Medicina (catálogo fictício de teste)",
    scope: "company",
    billingPeriod: "monthly",
    items: [
      {
        service: "medicine",
        label: "Medicina por empresa (fictício)",
        unit: "company",
        unitAmountCents: 22222,
      },
    ],
    quotas: [{ metric: "employees", limit: 111 }],
  }),
  fictitiousOffer({
    code: "ficticio-pgr-medicina",
    name: "PGR e Medicina (catálogo fictício de teste)",
    scope: "company",
    billingPeriod: "monthly",
    items: [
      {
        service: "pgr",
        label: "PGR por empresa (fictício)",
        unit: "company",
        unitAmountCents: 11111,
      },
      {
        service: "medicine",
        label: "Medicina por empresa (fictício)",
        unit: "company",
        unitAmountCents: 22222,
      },
    ],
    quotas: [{ metric: "employees", limit: 111 }],
  }),
  fictitiousOffer({
    code: "ficticio-pro",
    name: "Pro (catálogo fictício de teste)",
    scope: "organization",
    billingPeriod: "monthly",
    items: [
      {
        service: "pro",
        label: "Pro por escritório (fictício)",
        unit: "organization",
        unitAmountCents: 33333,
      },
    ],
    quotas: [],
  }),
  fictitiousOffer({
    code: "ficticio-avulso-documento",
    name: "Documento avulso (catálogo fictício de teste)",
    scope: "company",
    billingPeriod: "one_time",
    items: [
      {
        service: "one_off",
        label: "Documento avulso (fictício)",
        unit: "document",
        unitAmountCents: 4444,
      },
    ],
    quotas: [{ metric: "documents", limit: 1 }],
  }),
];
