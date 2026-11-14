import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockStaff = jest.fn();
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: () => mockStaff(),
}));

import { adminClient, applyMigrations } from "../_helpers/db";
import { PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  acting,
  clientUser,
  collaborator,
  contractOffer,
  errorCode,
  outsider,
  owner,
  seedCommercialBase,
} from "../_helpers/commercial-seed";
import { getCommercialPlansOverviewAction } from "@/shared/server/actions/commercial/commercial";
import { getPlansOverview } from "@/shared/server/commercial/plans-overview-core";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;

(enabled ? describe : describe.skip)("visão de planos e contratações", () => {
  let admin: ReturnType<typeof postgres>;
  const oldEnv = { ...process.env };
  const overview = (ctx = owner) => acting(ctx, (actor) => getPlansOverview(actor));

  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages=warning`;
    await applyMigrations(admin);
  });
  afterAll(async () => {
    process.env = oldEnv;
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedCommercialBase(admin);
    mockStaff.mockReset();
    mockStaff.mockResolvedValue(owner);
    process.env.APP_ENV = "local";
    process.env.COMMERCIAL_CATALOG_ENABLED = "true";
  });

  it("owner vê ofertas, pagador, empresas e a contratação ainda sem pagamento", async () => {
    const contract = await contractOffer(drizzle(admin), "pgr");
    const result = await overview();
    expect(result.canContract).toBe(true);
    expect(result.readOnlyMessage).toBeNull();
    expect(result.offers.map((offer) => offer.id)).toContain(contract.offerVersionId);
    expect(result.offers.every((offer) => offer.fictitious)).toBe(true);
    expect(result.customers.map((customer) => customer.kind)).toEqual(["office"]);
    expect(result.companies.map((company) => company.id)).toContain(I.companyA);
    expect(result.contracts).toEqual([
      expect.objectContaining({
        id: contract.id,
        companyIds: [I.companyA],
        payment: "pending",
      }),
    ]);
  });

  it("direito de uso ativo aparece como liberado", async () => {
    const contract = await contractOffer(drizzle(admin), "pgr");
    await admin`insert into commercial_entitlements (org_id, contract_id, company_id, service, status, reason, applied)
      values ('org_a', ${contract.id}, ${I.companyA}, 'pgr', 'active', 'subscription_active', true)`;
    expect((await overview()).contracts[0].payment).toBe("released");
  });

  it("collaborator consulta as ofertas sem dados financeiros", async () => {
    await contractOffer(drizzle(admin), "pgr");
    const result = await overview(collaborator);
    expect(result.canContract).toBe(false);
    expect(result.readOnlyMessage).not.toBeNull();
    expect(result.offers).toHaveLength(1);
    expect(result.customers).toEqual([]);
    expect(result.contracts).toEqual([]);
  });

  it("client recebe FORBIDDEN", async () => {
    expect(await errorCode(() => overview(clientUser))).toBe("FORBIDDEN");
  });

  it("outro escritório não vê pagador nem contratação alheios", async () => {
    await contractOffer(drizzle(admin), "pgr");
    const result = await overview(outsider);
    expect(result.customers).toEqual([]);
    expect(result.contracts).toEqual([]);
    expect(result.companies.map((company) => company.id)).not.toContain(I.companyA);
  });

  it("flag desligada responde FORBIDDEN na action", async () => {
    process.env.COMMERCIAL_CATALOG_ENABLED = "false";
    expect(await getCommercialPlansOverviewAction()).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });
});
