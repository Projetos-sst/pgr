jest.mock("@/shared/db/repositories/orgs", () => ({
  getOrgById: jest.fn(),
  getOrgByStripeCustomerId: jest.fn(),
  updateOrgBilling: jest.fn(),
}));
jest.mock("@/shared/integrations/stripe/client", () => ({
  createProCheckoutSession: jest.fn(),
}));

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as orgs from "@/shared/db/repositories/orgs";
import * as stripe from "@/shared/integrations/stripe/client";
import {
  handleStripeEvent,
  startProCheckout,
} from "@/shared/server/platform/billing-core";

const asMock = (fn: unknown) => fn as jest.Mock;

function ctx(overrides: Partial<TenantContext> = {}): TenantContext {
  return { userId: "u", tenantId: "org_a", role: "owner", plan: "free", ...overrides };
}

beforeEach(() => jest.clearAllMocks());

describe("startProCheckout", () => {
  it("owner → cria sessão e devolve a URL", async () => {
    asMock(orgs.getOrgById).mockResolvedValue({ id: "org_a", stripeCustomerId: null });
    asMock(stripe.createProCheckoutSession).mockResolvedValue({
      url: "https://checkout.stripe/x",
    });
    const result = await startProCheckout(ctx());
    expect(result.url).toBe("https://checkout.stripe/x");
  });

  it("não-owner → FORBIDDEN", async () => {
    await expect(startProCheckout(ctx({ role: "collaborator" }))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(stripe.createProCheckoutSession).not.toHaveBeenCalled();
  });
});

describe("handleStripeEvent", () => {
  it("checkout.session.completed → plano pro + ids", async () => {
    await handleStripeEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { orgId: "org_a" },
          customer: "cus_1",
          subscription: "sub_1",
        },
      },
    } as never);
    expect(orgs.updateOrgBilling).toHaveBeenCalledWith("org_a", {
      plan: "pro",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });
  });

  it("subscription.deleted → plano free", async () => {
    await handleStripeEvent({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "canceled",
          metadata: { orgId: "org_a" },
          trial_end: null,
        },
      },
    } as never);
    expect(asMock(orgs.updateOrgBilling).mock.calls[0][1].plan).toBe("free");
  });

  it("subscription trialing → pro + trialEndsAt; resolve org por customer se sem metadata", async () => {
    asMock(orgs.getOrgByStripeCustomerId).mockResolvedValue({ id: "org_b" });
    await handleStripeEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_9",
          customer: "cus_9",
          status: "trialing",
          metadata: {},
          trial_end: 1893456000,
        },
      },
    } as never);
    const [orgId, patch] = asMock(orgs.updateOrgBilling).mock.calls[0];
    expect(orgId).toBe("org_b");
    expect(patch.plan).toBe("pro");
    expect(patch.trialEndsAt).toBeInstanceOf(Date);
  });
});
