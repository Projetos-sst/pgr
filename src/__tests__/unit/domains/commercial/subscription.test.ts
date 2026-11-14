import {
  subscriptionStatusSchema,
  type SubscriptionStatus,
} from "@/shared/domains/commercial/billing-model";
import {
  PROVISIONAL_DELINQUENCY_POLICY,
  applySubscriptionSnapshot,
  canTransition,
  subscriptionAccess,
  type SubscriptionMirror,
  type SubscriptionSnapshot,
} from "@/shared/domains/commercial/subscription";

const at = (iso: string) => new Date(iso);
const snapshot = (
  overrides: Partial<SubscriptionSnapshot> = {},
): SubscriptionSnapshot => ({
  providerSubscriptionId: "sub_1",
  providerCustomerId: "cus_1",
  status: "active",
  currentPeriodStart: at("2026-11-01T00:00:00Z"),
  currentPeriodEnd: at("2026-12-01T00:00:00Z"),
  cancelAtPeriodEnd: false,
  canceledAt: null,
  ...overrides,
});
const mirror = (overrides: Partial<SubscriptionMirror> = {}): SubscriptionMirror => ({
  ...snapshot(),
  lastEventAt: at("2026-11-10T12:00:00Z"),
  ...overrides,
});
const now = { dueAt: null, asOf: at("2026-11-13T12:00:00Z") };
const provisional = { ...now, policy: PROVISIONAL_DELINQUENCY_POLICY };

describe("acesso pelo estado da assinatura", () => {
  const expected: [SubscriptionStatus, boolean, string][] = [
    ["active", true, "subscription_active"],
    ["trialing", true, "subscription_trialing"],
    ["past_due", false, "payment_past_due"],
    ["unpaid", false, "subscription_unpaid"],
    ["canceled", false, "subscription_canceled"],
    ["incomplete", false, "subscription_incomplete"],
    ["incomplete_expired", false, "subscription_incomplete_expired"],
    ["paused", false, "subscription_paused"],
  ];
  it.each(expected)("%s → liberado=%s (%s)", (status, granted, reason) => {
    expect(subscriptionAccess(status, provisional)).toEqual({ granted, reason });
  });

  it("cobre todos os estados que o provedor informa", () => {
    for (const status of subscriptionStatusSchema.options)
      expect(subscriptionAccess(status, provisional).reason).toMatch(/^[a-z_]+$/);
  });

  it("a política provisória não dá carência: atraso suspende mesmo com vencimento recém-confirmado", () => {
    expect(PROVISIONAL_DELINQUENCY_POLICY).toEqual({ graceDays: 0 });
    expect(
      subscriptionAccess("past_due", {
        ...provisional,
        dueAt: at("2026-11-13T11:59:59Z"),
      }),
    ).toEqual({ granted: false, reason: "payment_past_due" });
  });

  it("com carência aprovada, o atraso mantém o acesso até o vencimento confirmado pelo provedor mais a carência", () => {
    const policy = { graceDays: 5 };
    const dueAt = at("2026-11-10T12:00:00Z");
    expect(subscriptionAccess("past_due", { ...now, dueAt, policy })).toEqual({
      granted: true,
      reason: "payment_past_due_within_grace",
    });
    expect(
      subscriptionAccess("past_due", { dueAt, policy, asOf: at("2026-11-15T12:00:00Z") })
        .granted,
    ).toBe(true);
    expect(
      subscriptionAccess("past_due", { dueAt, policy, asOf: at("2026-11-15T12:00:01Z") }),
    ).toEqual({ granted: false, reason: "payment_past_due" });
  });

  it("sem vencimento confirmado pelo provedor não há carência", () => {
    expect(
      subscriptionAccess("past_due", { ...now, policy: { graceDays: 30 } }).granted,
    ).toBe(false);
  });
});

describe("transições do espelho", () => {
  it("estado final não volta: cancelada e expirada não reativam", () => {
    for (const to of subscriptionStatusSchema.options.filter((s) => s !== "canceled"))
      expect(canTransition("canceled", to)).toBe(false);
    expect(canTransition("incomplete_expired", "active")).toBe(false);
    expect(canTransition("canceled", "canceled")).toBe(true);
  });

  it("incompleta é só o começo: nenhum outro estado volta para ela", () => {
    expect(canTransition("active", "incomplete")).toBe(false);
    expect(canTransition("past_due", "incomplete")).toBe(false);
    expect(canTransition("incomplete", "incomplete")).toBe(true);
    expect(canTransition("incomplete", "active")).toBe(true);
  });

  it("falha, recuperação, renovação, pausa e cancelamento são transições válidas", () => {
    expect(canTransition("active", "past_due")).toBe(true);
    expect(canTransition("past_due", "active")).toBe(true);
    expect(canTransition("past_due", "unpaid")).toBe(true);
    expect(canTransition("unpaid", "active")).toBe(true);
    expect(canTransition("trialing", "active")).toBe(true);
    expect(canTransition("active", "paused")).toBe(true);
    expect(canTransition("paused", "active")).toBe(true);
    expect(canTransition("active", "canceled")).toBe(true);
  });
});

describe("aplicação de um evento de assinatura ao espelho", () => {
  it("primeiro evento cria o espelho com a hora do evento", () => {
    const occurredAt = at("2026-11-13T10:00:00Z");
    expect(applySubscriptionSnapshot(null, snapshot(), occurredAt)).toEqual({
      outcome: "applied",
      next: { ...snapshot(), lastEventAt: occurredAt },
    });
  });

  it("evento mais novo substitui estado, período e cancelamento agendado", () => {
    const occurredAt = at("2026-11-12T00:00:00Z");
    const next = snapshot({
      status: "past_due",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: at("2027-01-01T00:00:00Z"),
    });
    expect(applySubscriptionSnapshot(mirror(), next, occurredAt)).toEqual({
      outcome: "applied",
      next: { ...next, lastEventAt: occurredAt },
    });
  });

  it("evento mais antigo que o último aplicado é descartado como atrasado", () => {
    expect(
      applySubscriptionSnapshot(
        mirror({ status: "past_due" }),
        snapshot({ status: "active" }),
        at("2026-11-10T11:59:59Z"),
      ),
    ).toEqual({ outcome: "stale", detail: "older_than_last_applied" });
  });

  it("no mesmo segundo, o estado final vence: ativa não reabre assinatura cancelada", () => {
    const sameSecond = at("2026-11-10T12:00:00Z");
    expect(
      applySubscriptionSnapshot(
        mirror({ status: "canceled" }),
        snapshot({ status: "active" }),
        sameSecond,
      ),
    ).toEqual({ outcome: "stale", detail: "transition_not_allowed:canceled->active" });
    expect(
      applySubscriptionSnapshot(
        mirror({ status: "active" }),
        snapshot({ status: "incomplete" }),
        sameSecond,
      ),
    ).toEqual({ outcome: "stale", detail: "transition_not_allowed:active->incomplete" });
  });

  it("espelho criado pelo retorno do checkout aceita o primeiro evento de assinatura", () => {
    const occurredAt = at("2026-11-13T10:00:00Z");
    const decision = applySubscriptionSnapshot(
      mirror({ status: "incomplete", lastEventAt: null, providerCustomerId: "cus_1" }),
      snapshot({ providerCustomerId: null }),
      occurredAt,
    );
    expect(decision).toEqual({
      outcome: "applied",
      next: { ...snapshot(), lastEventAt: occurredAt },
    });
  });

  it("outra assinatura do provedor para a mesma contratação é ignorada", () => {
    expect(
      applySubscriptionSnapshot(
        mirror(),
        snapshot({ providerSubscriptionId: "sub_2" }),
        at("2026-11-13T10:00:00Z"),
      ),
    ).toEqual({ outcome: "ignored", detail: "another_subscription_for_contract" });
  });

  it("reaplicar o mesmo evento não muda o espelho", () => {
    const current = mirror();
    const decision = applySubscriptionSnapshot(
      current,
      snapshot(),
      at("2026-11-10T12:00:00Z"),
    );
    expect(decision).toEqual({ outcome: "applied", next: current });
  });
});
