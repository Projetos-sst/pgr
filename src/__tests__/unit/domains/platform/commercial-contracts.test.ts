import {
  billingOfferSchema,
  billingPolicySchema,
  isBillingSimulationEnabled,
  hasContractAccess,
  billingActions,
  totalMinor,
  normalizedBillingEventSchema,
} from "@/shared/domains/billing/contracts";

describe("commercial simulation contracts", () => {
  const policy = billingPolicySchema.parse({});
  it("requires an explicit non-production simulation environment", () => {
    for (const APP_ENV of [undefined, "production", "preview", "unknown"])
      expect(
        isBillingSimulationEnabled({
          APP_ENV,
          BILLING_MODE: "mock",
          BILLING_MOCK_ENABLED: "true",
        }),
      ).toBe(false);
    expect(
      isBillingSimulationEnabled({
        APP_ENV: "sandbox",
        BILLING_MODE: "mock",
        BILLING_MOCK_ENABLED: "true",
      }),
    ).toBe(true);
    expect(isBillingSimulationEnabled({ APP_ENV: "sandbox", BILLING_MODE: "mock" })).toBe(
      false,
    );
  });
  it("keeps prices in exact minor units and rejects duplicate products/card fields", () => {
    const offer = {
      code: "exemplo",
      name: "Oferta fictícia",
      interval: "month",
      items: [
        { product: "pgr", label: "PGR", amountMinor: 10001 },
        { product: "medicine", label: "Medicina", amountMinor: 20002 },
      ],
      limits: { companies: null, employees: null },
      policy: {},
      reason: "Teste fictício",
    };
    expect(totalMinor(billingOfferSchema.parse(offer).items)).toBe(30003);
    expect(
      billingOfferSchema.safeParse({ ...offer, items: [offer.items[0], offer.items[0]] })
        .success,
    ).toBe(false);
    expect(billingOfferSchema.safeParse({ ...offer, cardNumber: "forged" }).success).toBe(
      false,
    );
    expect(
      billingOfferSchema.safeParse({
        ...offer,
        items: [{ ...offer.items[0], amountMinor: 1.5 }],
      }).success,
    ).toBe(false);
  });
  it("does not interpret pending, refused, expired or redirected checkout as access", () => {
    const base = { periodEnd: new Date("2030-02-01Z"), trialEndsAt: null, policy };
    for (const status of [
      "pending_payment",
      "requires_action",
      "unpaid",
      "canceled",
      "expired",
    ] as const)
      expect(hasContractAccess({ ...base, status }, new Date("2030-01-01Z"))).toBe(false);
    expect(
      hasContractAccess({ ...base, status: "active" }, new Date("2030-02-01Z")),
    ).toBe(false);
    expect(
      hasContractAccess({ ...base, status: "active" }, new Date("2030-01-01Z")),
    ).toBe(true);
  });
  it("limits trial to 15 days without card or automatic export", () => {
    expect(policy).toMatchObject({
      trialDays: 15,
      trialRequiresCard: false,
      trialAllowsExport: false,
    });
    expect(billingPolicySchema.safeParse({ trialDays: 7 }).success).toBe(false);
    expect(
      hasContractAccess(
        {
          status: "trialing",
          periodEnd: null,
          trialEndsAt: new Date("2030-01-16Z"),
          policy,
        },
        new Date("2030-01-16Z"),
      ),
    ).toBe(false);
    expect(billingActions("active", true)).toContain("resume");
    expect(billingActions("active", true)).not.toContain("cancel");
  });
  it("rejects forged provider actors and inconsistent periods", () => {
    const event = {
      eventId: "mock_1",
      contractId: "11111111-1111-4111-8111-111111111111",
      revision: 1,
      status: "active",
      periodStart: "2030-01-01T00:00:00Z",
      periodEnd: "2030-02-01T00:00:00Z",
      occurredAt: "2030-01-01T00:00:00Z",
      kind: "payment_confirmed",
    };
    expect(normalizedBillingEventSchema.safeParse(event).success).toBe(true);
    expect(
      normalizedBillingEventSchema.safeParse({ ...event, orgId: "other" }).success,
    ).toBe(false);
    expect(
      normalizedBillingEventSchema.safeParse({ ...event, periodEnd: event.periodStart })
        .success,
    ).toBe(false);
  });
});
