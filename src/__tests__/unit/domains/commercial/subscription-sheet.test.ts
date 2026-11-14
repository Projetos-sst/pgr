import {
  availableActions,
  contractAccessState,
  invoiceBreakdown,
  rightAccessState,
  subscriptionAccessAt,
  type RightFacts,
  type SubscriptionFacts,
} from "@/shared/domains/commercial/subscription-sheet";

describe("availableActions", () => {
  const ready = {
    paymentAvailable: true,
    hasProviderCustomer: true,
    hasOpenCheckout: false,
  };

  it("oferece o portal quando há cliente no provedor e o modo de teste está disponível", () => {
    expect(availableActions(ready)).toEqual(["manage_in_portal"]);
  });

  it("oferece retomar pagamento quando há checkout aberto", () => {
    expect(
      availableActions({ ...ready, hasProviderCustomer: false, hasOpenCheckout: true }),
    ).toEqual(["resume_checkout"]);
  });

  it("oferece as duas ações na ordem fixa quando ambas se aplicam", () => {
    expect(availableActions({ ...ready, hasOpenCheckout: true })).toEqual([
      "manage_in_portal",
      "resume_checkout",
    ]);
  });

  it("sem cliente no provedor e sem checkout aberto não há ação", () => {
    expect(availableActions({ ...ready, hasProviderCustomer: false })).toEqual([]);
  });

  it("pagamento indisponível não deixa nenhuma ação, nem com checkout aberto", () => {
    expect(
      availableActions({
        paymentAvailable: false,
        hasProviderCustomer: true,
        hasOpenCheckout: true,
      }),
    ).toEqual([]);
  });
});

describe("acesso separado do pagamento", () => {
  it("direito ativo e aplicado é acesso liberado", () => {
    expect(rightAccessState({ status: "active", applied: true })).toBe("granted");
  });

  it("direito ativo sem aplicação pela contratação é legado ou cortesia", () => {
    expect(rightAccessState({ status: "active", applied: false })).toBe("legacy");
  });

  it("direito inativo é acesso suspenso", () => {
    expect(rightAccessState({ status: "inactive", applied: true })).toBe("suspended");
    expect(rightAccessState({ status: "inactive", applied: false })).toBe("suspended");
  });

  it("sem direitos registrados não há estado de acesso", () => {
    expect(contractAccessState([])).toBe("none");
  });

  it("o estado agregado prioriza liberado, depois legado, depois suspenso", () => {
    const inactive: RightFacts = { status: "inactive", applied: true };
    const legacy: RightFacts = { status: "active", applied: false };
    const granted: RightFacts = { status: "active", applied: true };
    expect(contractAccessState([inactive, legacy, granted])).toBe("granted");
    expect(contractAccessState([inactive, legacy])).toBe("legacy");
    expect(contractAccessState([inactive])).toBe("suspended");
  });
});

describe("cancelamento agendado", () => {
  const periodEnd = new Date("2026-12-13T12:00:00.000Z");
  const scheduled: SubscriptionFacts = {
    status: "active",
    cancelAtPeriodEnd: true,
    currentPeriodEnd: periodEnd,
  };

  it("mantém o acesso antes do fim do período e informa até quando", () => {
    const access = subscriptionAccessAt(scheduled, new Date("2026-12-13T11:59:59.000Z"));
    expect(access.granted).toBe(true);
    expect(access.until).toEqual(periodEnd);
  });

  it("mantém o acesso no meio do período", () => {
    expect(subscriptionAccessAt(scheduled, new Date("2026-11-20T00:00:00.000Z"))).toEqual(
      expect.objectContaining({ granted: true, reason: "subscription_active" }),
    );
  });

  it("sem cancelamento agendado não há data de manutenção", () => {
    const access = subscriptionAccessAt(
      { ...scheduled, cancelAtPeriodEnd: false },
      new Date("2026-11-20T00:00:00.000Z"),
    );
    expect(access).toEqual(expect.objectContaining({ granted: true, until: null }));
  });

  it("depois que o provedor cancela de fato, o acesso termina", () => {
    const access = subscriptionAccessAt(
      { ...scheduled, status: "canceled" },
      new Date("2026-12-14T00:00:00.000Z"),
    );
    expect(access).toEqual(expect.objectContaining({ granted: false, until: null }));
  });
});

describe("detalhamento da fatura", () => {
  it("agrupa Pro e avulso em demais e mantém o não classificado à parte", () => {
    const rows = invoiceBreakdown({
      pgr: 100,
      medicine: 200,
      pro: 30,
      one_off: 40,
      unclassified: 5,
    });
    expect(rows.map((row) => [row.label, row.cents])).toEqual([
      ["PGR", 100],
      ["Medicina", 200],
      ["Demais", 70],
      ["Não classificado", 5],
    ]);
  });
});
