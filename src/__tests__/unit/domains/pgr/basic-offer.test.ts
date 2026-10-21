import {
  basicOfferSchema,
  basicOfferMissingFields,
  basicOfferPublicationSchema,
  basicOfferPriceSchema,
} from "@/shared/domains/pgr/basic-offer";
const draft = {
  name: "PGR básico",
  eligibility: "",
  technicalScope: "",
  servicesIncluded: "",
  limitations: "",
  priceCents: null,
  currency: "BRL",
  billingPeriod: null,
  maxEmployees: null,
  maxWorkUnits: null,
  maxRevisions: null,
  reason: "Proposta para revisão",
};
it("preserves unknown commercial conditions in a draft without inventing a price", () => {
  const result = basicOfferSchema.parse(draft);
  expect(result.priceCents).toBeNull();
  expect(basicOfferMissingFields(result)).toEqual(
    expect.arrayContaining(["priceCents", "eligibility", "billingPeriod"]),
  );
});
it("requires explicit approval references and expected publication state", () => {
  expect(
    basicOfferPublicationSchema.safeParse({
      active: true,
      expectedActiveVersionId: null,
      reason: "Publicação",
    }).success,
  ).toBe(false);
  expect(
    basicOfferPublicationSchema.safeParse({
      active: false,
      expectedActiveVersionId: null,
      reason: "Retirada",
    }).success,
  ).toBe(true);
});
it("parses BRL exactly and rejects silent rounding or negative prices", () => {
  expect(basicOfferPriceSchema.parse("1500,25")).toBe(150025);
  expect(basicOfferPriceSchema.parse("0")).toBe(0);
  for (const value of ["0,001", "1.234,56", "-10", "abc"])
    expect(basicOfferPriceSchema.safeParse(value).success).toBe(false);
});
it("does not accept actor, active flag or fractional limits in immutable versions", () => {
  for (const change of [
    { createdBy: "injected" },
    { active: true },
    { maxEmployees: 1.5 },
  ])
    expect(basicOfferSchema.safeParse({ ...draft, ...change }).success).toBe(false);
});
