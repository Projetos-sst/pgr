import type { TenantContext } from "@/shared/auth/require-tenant-context";

const mockOffers = jest.fn();
const mockTrials = jest.fn();
const mockCustomers = jest.fn();
const mockContracts = jest.fn();
const mockContract = jest.fn();
const mockBilling = jest.fn();
const mockCompanies = jest.fn();

jest.mock("@/shared/server/commercial/commercial-core", () => ({
  listSellableOffers: (ctx: unknown) => mockOffers(ctx),
  listCompanyTrials: (ctx: unknown, filters: unknown) => mockTrials(ctx, filters),
  listCustomers: (ctx: unknown, filters: unknown) => mockCustomers(ctx, filters),
  listContracts: (ctx: unknown, filters: unknown) => mockContracts(ctx, filters),
  getContract: (ctx: unknown, id: string) => mockContract(ctx, id),
}));
jest.mock("@/shared/server/commercial/billing-events-core", () => ({
  getContractBilling: (ctx: unknown, id: string) => mockBilling(ctx, id),
}));
jest.mock("@/shared/db/repositories/companies", () => ({
  listCompanyOptions: (orgId: string) => mockCompanies(orgId),
}));

import { getPlansOverview } from "@/shared/server/commercial/plans-overview-core";

const STORED_OFFER = {
  id: "offer-1",
  code: "ficticio-pgr",
  version: 1,
  name: "PGR fictício",
  description: "Oferta de teste",
  scope: "company",
  billingPeriod: "monthly",
  quotas: [{ metric: "pgr_emissions", limit: 10 }],
  fictitious: true,
  items: [
    { service: "pgr", label: "PGR por empresa", unit: "company", unitAmountCents: 4900 },
  ],
};

function contextOf(role: string): TenantContext {
  return { tenantId: "org_a", userId: "user_a", plan: "free", role };
}

describe("getPlansOverview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOffers.mockResolvedValue([{ ...STORED_OFFER, publishedBy: "operador" }]);
    mockTrials.mockResolvedValue({
      rows: [
        { companyId: "c1", status: "active", endsAt: new Date("2026-12-01T00:00:00Z") },
      ],
      total: 1,
    });
    mockCompanies.mockResolvedValue([{ id: "c1", razaoSocial: "Empresa Um" }]);
    mockCustomers.mockResolvedValue({
      rows: [{ id: "cu1", kind: "office", companyId: null, legalName: "Consultoria" }],
      total: 1,
    });
    mockContracts.mockResolvedValue({
      rows: [
        {
          id: "k1",
          offerVersionId: "offer-1",
          offerCode: "ficticio-pgr",
          offerName: "PGR",
          customerId: "cu1",
          termStart: "2026-11-01",
        },
      ],
      total: 1,
    });
    mockContract.mockResolvedValue({ companyIds: ["c1"] });
    mockBilling.mockResolvedValue({
      checkout: { status: "completed" },
      entitlements: [],
    });
  });

  it("owner recebe ofertas, testes, pagadores, empresas e contratações com situação", async () => {
    const overview = await getPlansOverview(contextOf("owner"));
    expect(overview.canContract).toBe(true);
    expect(overview.readOnlyMessage).toBeNull();
    expect(overview.termStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(overview.offers).toEqual([STORED_OFFER]);
    expect(overview.trials).toEqual([
      { companyId: "c1", status: "active", endsAt: "2026-12-01T00:00:00.000Z" },
    ]);
    expect(overview.customers).toHaveLength(1);
    expect(overview.companies).toEqual([{ id: "c1", name: "Empresa Um" }]);
    expect(overview.contracts).toEqual([
      expect.objectContaining({ id: "k1", companyIds: ["c1"], payment: "processing" }),
    ]);
    expect(mockCompanies).toHaveBeenCalledWith("org_a");
  });

  it("collaborator lê ofertas e testes, sem cobrança, e nunca recebe FORBIDDEN", async () => {
    const overview = await getPlansOverview(contextOf("collaborator"));
    expect(overview.canContract).toBe(false);
    expect(overview.readOnlyMessage).toContain("Apenas o administrador contrata");
    expect(overview.offers).toHaveLength(1);
    expect(overview.customers).toEqual([]);
    expect(overview.contracts).toEqual([]);
    expect(mockCustomers).not.toHaveBeenCalled();
    expect(mockContracts).not.toHaveBeenCalled();
    expect(mockBilling).not.toHaveBeenCalled();
  });
});
