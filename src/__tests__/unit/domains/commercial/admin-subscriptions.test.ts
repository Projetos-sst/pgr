import {
  adminSubscriptionFiltersSchema,
  entitlementsChangedCount,
  mirrorFieldsChanged,
  reconcileInputSchema,
  reconciliationResult,
  subscriptionDivergence,
} from "@/shared/domains/commercial/admin-subscriptions";
import type { SubscriptionMirror } from "@/shared/domains/commercial/subscription";

const AS_OF = new Date("2026-11-14T12:00:00Z");
const CONTRACT = "22222222-2222-2222-2222-222222222222";

const mirror = (patch: Partial<SubscriptionMirror> = {}): SubscriptionMirror => ({
  providerSubscriptionId: "sub_1",
  providerCustomerId: "cus_1",
  status: "active",
  currentPeriodStart: new Date("2026-11-01T00:00:00Z"),
  currentPeriodEnd: new Date("2026-12-01T00:00:00Z"),
  cancelAtPeriodEnd: false,
  canceledAt: null,
  lastEventAt: new Date("2026-11-02T00:00:00Z"),
  ...patch,
});

const active = { status: "active" } as const;
const inactive = { status: "inactive" } as const;

describe("subscriptionDivergence", () => {
  it("espelho ativo com direitos ativos: sem divergência", () => {
    expect(
      subscriptionDivergence({
        mirror: mirror(),
        entitlements: [active, active],
        asOf: AS_OF,
      }),
    ).toBe("none");
  });

  it("espelho cancelado com direitos inativos: sem divergência", () => {
    expect(
      subscriptionDivergence({
        mirror: mirror({ status: "canceled" }),
        entitlements: [inactive],
        asOf: AS_OF,
      }),
    ).toBe("none");
  });

  it("espelho ativo com direito inativo: divergência de direitos", () => {
    expect(
      subscriptionDivergence({
        mirror: mirror(),
        entitlements: [active, inactive],
        asOf: AS_OF,
      }),
    ).toBe("entitlement_mismatch");
  });

  it("espelho cancelado com direito ainda ativo: divergência de direitos", () => {
    expect(
      subscriptionDivergence({
        mirror: mirror({ status: "canceled" }),
        entitlements: [active],
        asOf: AS_OF,
      }),
    ).toBe("entitlement_mismatch");
  });

  it("sem direitos gravados", () => {
    expect(
      subscriptionDivergence({ mirror: mirror(), entitlements: [], asOf: AS_OF }),
    ).toBe("no_entitlements");
  });

  it("sem espelho: nunca sincronizada", () => {
    expect(subscriptionDivergence({ mirror: null, entitlements: [], asOf: AS_OF })).toBe(
      "never_synced",
    );
  });

  it("espelho sem nenhum evento aplicado e direitos divergentes: nunca sincronizada", () => {
    expect(
      subscriptionDivergence({
        mirror: mirror({ lastEventAt: null }),
        entitlements: [inactive],
        asOf: AS_OF,
      }),
    ).toBe("never_synced");
  });
});

describe("resultado da reconciliação", () => {
  it("fonte não conferida é sempre source_unavailable", () => {
    expect(reconciliationResult({ sourceChecked: false, changed: true })).toBe(
      "source_unavailable",
    );
    expect(reconciliationResult({ sourceChecked: false, changed: false })).toBe(
      "source_unavailable",
    );
  });

  it("fonte conferida: corrected com mudança, no_change sem", () => {
    expect(reconciliationResult({ sourceChecked: true, changed: true })).toBe(
      "corrected",
    );
    expect(reconciliationResult({ sourceChecked: true, changed: false })).toBe(
      "no_change",
    );
  });

  it("mudança do espelho ignora o instante do último evento", () => {
    expect(
      mirrorFieldsChanged(
        mirror(),
        mirror({ lastEventAt: new Date("2026-11-14T00:00:00Z") }),
      ),
    ).toBe(false);
    expect(mirrorFieldsChanged(mirror(), mirror({ status: "past_due" }))).toBe(true);
    expect(mirrorFieldsChanged(mirror(), mirror({ cancelAtPeriodEnd: true }))).toBe(true);
    expect(mirrorFieldsChanged(null, null)).toBe(false);
    expect(mirrorFieldsChanged(null, mirror())).toBe(true);
  });

  it("conta só os direitos cuja situação ou motivo mudou", () => {
    const before = [
      { id: "a", status: "inactive", reason: "x" },
      { id: "b", status: "active", reason: "y" },
    ];
    const after = [
      { id: "a", status: "active", reason: "y" },
      { id: "b", status: "active", reason: "y" },
    ];
    expect(entitlementsChangedCount(before, after)).toBe(1);
    expect(entitlementsChangedCount(after, after)).toBe(0);
  });
});

describe("filtros", () => {
  it("aceita todos os filtros válidos e converte a página", () => {
    const parsed = adminSubscriptionFiltersSchema.parse({
      orgId: "org_a",
      companyId: "11111111-1111-1111-1111-1111111111c1",
      service: "pgr",
      status: "active",
      from: "2026-11-01",
      to: "2026-11-30",
      search: "sub_123",
      page: "2",
    });
    expect(parsed).toMatchObject({ service: "pgr", status: "active", page: 2 });
  });

  it("campos em branco viram ausentes", () => {
    expect(
      adminSubscriptionFiltersSchema.parse({ orgId: "", service: "", status: "" }),
    ).toEqual({});
  });

  it.each([
    ["serviço desconhecido", { service: "one_off" }],
    ["status desconhecido", { status: "ativa" }],
    ["data inválida", { from: "13/11/2026" }],
    ["empresa inválida", { companyId: "abc" }],
    ["período invertido", { from: "2026-12-01", to: "2026-11-01" }],
    ["página zero", { page: "0" }],
  ])("rejeita %s", (_name, input) => {
    expect(adminSubscriptionFiltersSchema.safeParse(input).success).toBe(false);
  });
});

describe("motivo da reconciliação", () => {
  const input = (reason: unknown) => ({ orgId: "org_a", contractId: CONTRACT, reason });

  it("aceita motivo com 10 caracteres ou mais e remove espaços das pontas", () => {
    const parsed = reconcileInputSchema.parse(input("  conferência manual  "));
    expect(parsed.reason).toBe("conferência manual");
  });

  it.each([["curto"], ["         x         "], [""], [undefined]])(
    "rejeita %p",
    (reason) => {
      const parsed = reconcileInputSchema.safeParse(input(reason));
      expect(parsed.success).toBe(false);
    },
  );

  it("rejeita contratação ou escritório inválidos", () => {
    expect(
      reconcileInputSchema.safeParse({
        orgId: "org_a",
        contractId: "x",
        reason: "motivo suficiente",
      }).success,
    ).toBe(false);
    expect(
      reconcileInputSchema.safeParse({
        orgId: "",
        contractId: CONTRACT,
        reason: "motivo suficiente",
      }).success,
    ).toBe(false);
  });
});
