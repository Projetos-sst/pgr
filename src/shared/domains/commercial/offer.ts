import { z } from "zod";

export const FICTITIOUS_OFFER_CODE_PREFIX = "ficticio-";
export const MAX_AMOUNT_CENTS = 100_000_000;

export const commercialServiceSchema = z.enum(["pgr", "medicine", "pro", "one_off"]);
export type CommercialService = z.infer<typeof commercialServiceSchema>;

export const commercialUnitSchema = z.enum([
  "organization",
  "company",
  "employee",
  "document",
]);
export type CommercialUnit = z.infer<typeof commercialUnitSchema>;

export const billingPeriodSchema = z.enum(["monthly", "annual", "one_time"]);
export type BillingPeriod = z.infer<typeof billingPeriodSchema>;

export const offerScopeSchema = z.enum(["organization", "company"]);
export type OfferScope = z.infer<typeof offerScopeSchema>;

export const amountCentsSchema = z.number().int().min(0).max(MAX_AMOUNT_CENTS);
export const civilDateSchema = z.iso.date("Informe a data no formato AAAA-MM-DD.");

export const offerItemSchema = z
  .object({
    service: commercialServiceSchema,
    label: z.string().trim().min(1).max(150),
    unit: commercialUnitSchema,
    unitAmountCents: amountCentsSchema,
  })
  .strict();
export type OfferItem = z.infer<typeof offerItemSchema>;

export const offerQuotaSchema = z
  .object({
    metric: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_]{1,59}$/, "Use letras minúsculas, números e sublinhado."),
    limit: z.number().int().positive().max(1_000_000),
  })
  .strict();
export type OfferQuota = z.infer<typeof offerQuotaSchema>;

const offerVersionShape = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9_-]{1,79}$/, "Use letras minúsculas, números e hífen."),
    name: z.string().trim().min(2).max(150),
    description: z.string().trim().max(3000),
    scope: offerScopeSchema,
    currency: z.literal("BRL"),
    billingPeriod: billingPeriodSchema,
    items: z.array(offerItemSchema).min(1).max(20),
    quotas: z.array(offerQuotaSchema).max(20),
    validFrom: civilDateSchema,
    validUntil: civilDateSchema.nullable(),
    fictitious: z.boolean(),
    approvalReference: z.string().trim().min(1).max(2000).nullable(),
  })
  .strict();
type OfferVersionShape = z.infer<typeof offerVersionShape>;

const hasRepeated = (values: readonly string[]) => new Set(values).size !== values.length;

const OFFER_RULES: {
  path: keyof OfferVersionShape;
  message: string;
  broken: (offer: OfferVersionShape) => boolean;
}[] = [
  {
    path: "code",
    message: `Só a oferta fictícia usa o prefixo "${FICTITIOUS_OFFER_CODE_PREFIX}", e toda oferta fictícia precisa dele.`,
    broken: (offer) =>
      offer.code.startsWith(FICTITIOUS_OFFER_CODE_PREFIX) !== offer.fictitious,
  },
  {
    path: "approvalReference",
    message:
      "Oferta real exige a referência da aprovação comercial; oferta fictícia não pode declarar aprovação.",
    broken: (offer) => offer.fictitious === (offer.approvalReference !== null),
  },
  {
    path: "validUntil",
    message: "O fim da vigência não pode ser anterior ao início.",
    broken: (offer) => offer.validUntil !== null && offer.validUntil < offer.validFrom,
  },
  {
    path: "items",
    message: "Cada item da oferta precisa de um rótulo diferente.",
    broken: (offer) => hasRepeated(offer.items.map((item) => item.label)),
  },
  {
    path: "quotas",
    message: "Cada cota aparece uma única vez na oferta.",
    broken: (offer) => hasRepeated(offer.quotas.map((quota) => quota.metric)),
  },
];

export const offerVersionInputSchema = offerVersionShape.superRefine((offer, ctx) => {
  for (const rule of OFFER_RULES.filter((candidate) => candidate.broken(offer)))
    ctx.addIssue({ code: "custom", path: [rule.path], message: rule.message });
});
export type OfferVersionInput = z.infer<typeof offerVersionInputSchema>;

export type OfferLifecycle = {
  publishedAt: Date | null;
  deactivatedAt: Date | null;
  validFrom: string;
  validUntil: string | null;
};
export type OfferState = "draft" | "scheduled" | "on_sale" | "expired" | "deactivated";

export function offerState(version: OfferLifecycle, today: string): OfferState {
  if (version.deactivatedAt) return "deactivated";
  if (!version.publishedAt) return "draft";
  if (today < version.validFrom) return "scheduled";
  if (version.validUntil !== null && today > version.validUntil) return "expired";
  return "on_sale";
}

type VersionedOffer = OfferLifecycle & { code: string; version: number };

export function currentOffers<T extends VersionedOffer>(
  versions: readonly T[],
  today: string,
): T[] {
  const newestByCode = new Map<string, T>();
  for (const candidate of versions) {
    const newest = newestByCode.get(candidate.code);
    const onSale = offerState(candidate, today) === "on_sale";
    if (onSale && (!newest || candidate.version > newest.version))
      newestByCode.set(candidate.code, candidate);
  }
  return [...newestByCode.values()].sort((a, b) => (a.code < b.code ? -1 : 1));
}

export type CommercialEnvironment = {
  APP_ENV?: string;
  COMMERCIAL_CATALOG_ENABLED?: string;
};

export function isCommercialCatalogEnabledFor(env: CommercialEnvironment): boolean {
  return env.COMMERCIAL_CATALOG_ENABLED === "true";
}

export function isFictitiousCatalogAllowedFor(env: CommercialEnvironment): boolean {
  const appEnv = env.APP_ENV?.trim().toLowerCase() ?? "";
  return appEnv !== "" && appEnv !== "production";
}

export function sellableOffers<T extends VersionedOffer & { fictitious: boolean }>(
  versions: readonly T[],
  today: string,
  env: CommercialEnvironment,
): T[] {
  const fictitiousAllowed = isFictitiousCatalogAllowedFor(env);
  return currentOffers(versions, today).filter(
    (offer) => fictitiousAllowed || !offer.fictitious,
  );
}
