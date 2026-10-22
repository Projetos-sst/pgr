import { z } from "zod";
const text = z.string().trim().max(5000);
export const basicOfferPriceSchema = z
  .string()
  .trim()
  .regex(
    /^\d+(?:[,.]\d{1,2})?$/,
    "Informe o preço sem separador de milhar e com até duas casas decimais.",
  )
  .transform((value) => Math.round(Number(value.replace(",", ".")) * 100))
  .pipe(z.number().int().min(0).max(100000000));
const nullableLimit = z.number().int().positive().max(1000000).nullable();
export const basicOfferSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    eligibility: text,
    technicalScope: text,
    servicesIncluded: text,
    limitations: text,
    priceCents: z.number().int().min(0).max(100000000).nullable(),
    currency: z.literal("BRL"),
    billingPeriod: z.enum(["one_time", "monthly", "annual"]).nullable(),
    maxEmployees: nullableLimit,
    maxWorkUnits: nullableLimit,
    maxRevisions: z.number().int().min(0).max(10000).nullable(),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();
export type BasicOfferInput = z.infer<typeof basicOfferSchema>;
export const basicOfferPublicationSchema = z.discriminatedUnion("active", [
  z
    .object({
      active: z.literal(true),
      expectedActiveVersionId: z.uuid().nullable(),
      commercialApprovalReference: z.string().trim().min(1).max(2000),
      technicalApprovalReference: z.string().trim().min(1).max(2000),
      reason: z.string().trim().min(1).max(1000),
    })
    .strict(),
  z
    .object({
      active: z.literal(false),
      expectedActiveVersionId: z.uuid().nullable(),
      reason: z.string().trim().min(1).max(1000),
    })
    .strict(),
]);
export function basicOfferMissingFields(offer: BasicOfferInput) {
  const missing: string[] = [];
  for (const field of [
    "eligibility",
    "technicalScope",
    "servicesIncluded",
    "limitations",
  ] as const)
    if (!offer[field].trim()) missing.push(field);
  if (offer.priceCents === null) missing.push("priceCents");
  if (offer.billingPeriod === null) missing.push("billingPeriod");
  return missing;
}
