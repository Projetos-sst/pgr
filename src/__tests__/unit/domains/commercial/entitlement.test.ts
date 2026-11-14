import {
  contractTargets,
  entitlementChanges,
  type StoredEntitlement,
} from "@/shared/domains/commercial/entitlement";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("direitos de uso de uma contratação", () => {
  it("PGR libera só PGR para cada empresa da contratação", () => {
    expect(contractTargets({ items: [{ service: "pgr" }], companyIds: [B, A] })).toEqual([
      { companyId: A, service: "pgr" },
      { companyId: B, service: "pgr" },
    ]);
  });

  it("Medicina libera só Medicina", () => {
    expect(
      contractTargets({ items: [{ service: "medicine" }], companyIds: [A] }),
    ).toEqual([{ companyId: A, service: "medicine" }]);
  });

  it("PGR e Medicina liberam os dois por empresa, sem repetir serviço com mais de um item", () => {
    expect(
      contractTargets({
        items: [{ service: "pgr" }, { service: "medicine" }, { service: "pgr" }],
        companyIds: [A],
      }),
    ).toEqual([
      { companyId: A, service: "medicine" },
      { companyId: A, service: "pgr" },
    ]);
  });

  it("Pro é do escritório e não libera PGR nem Medicina", () => {
    expect(contractTargets({ items: [{ service: "pro" }], companyIds: [] })).toEqual([
      { companyId: null, service: "pro" },
    ]);
  });

  it("item avulso não gera direito de uso de módulo", () => {
    expect(contractTargets({ items: [{ service: "one_off" }], companyIds: [A] })).toEqual(
      [],
    );
  });
});

describe("mudanças de direito de uso", () => {
  const rows: StoredEntitlement[] = [
    { id: "e1", status: "inactive", reason: "subscription_incomplete" },
    { id: "e2", status: "active", reason: "subscription_active" },
  ];

  it("ativa o que estava inativo e não mexe no que já está igual", () => {
    expect(
      entitlementChanges(rows, { granted: true, reason: "subscription_active" }),
    ).toEqual([
      { id: "e1", status: "active", reason: "subscription_active", statusChanged: true },
    ]);
  });

  it("inativa o que estava ativo e atualiza só o motivo do que já estava inativo", () => {
    expect(
      entitlementChanges(rows, { granted: false, reason: "subscription_canceled" }),
    ).toEqual([
      {
        id: "e1",
        status: "inactive",
        reason: "subscription_canceled",
        statusChanged: false,
      },
      {
        id: "e2",
        status: "inactive",
        reason: "subscription_canceled",
        statusChanged: true,
      },
    ]);
  });

  it("evento repetido não gera mudança", () => {
    const active = [rows[1]];
    expect(
      entitlementChanges(active, { granted: true, reason: "subscription_active" }),
    ).toEqual([]);
  });
});
