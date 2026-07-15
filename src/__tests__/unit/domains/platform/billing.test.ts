import { planFromSubscriptionStatus } from "@/shared/domains/platform/billing";

describe("planFromSubscriptionStatus", () => {
  it("active/trialing → pro", () => {
    expect(planFromSubscriptionStatus("active")).toBe("pro");
    expect(planFromSubscriptionStatus("trialing")).toBe("pro");
  });

  it("qualquer outro status → free", () => {
    for (const s of ["canceled", "unpaid", "past_due", "incomplete", "paused"]) {
      expect(planFromSubscriptionStatus(s)).toBe("free");
    }
  });
});
