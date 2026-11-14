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
jest.mock("@/shared/integrations/stripe/client", () => ({
  createCommercialCheckoutSession: jest.fn(),
  createCommercialPortalSession: jest.fn(),
}));

import { adminClient, applyMigrations } from "../_helpers/db";
import { PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  UNKNOWN_ID,
  acting,
  clientUser,
  collaborator,
  contractOffer,
  devRequest,
  errorCode,
  outsider,
  owner,
  routeParams,
  seedCommercialBase,
} from "../_helpers/commercial-seed";
import * as portalRoute from "@/app/api/v1/commercial-contracts/[id]/portal-session/route";
import * as sheetRoute from "@/app/api/v1/commercial-subscription-sheet/route";
import {
  createCommercialCheckoutSession,
  createCommercialPortalSession as openPortal,
} from "@/shared/integrations/stripe/client";
import {
  createCommercialPortalSessionAction,
  getCommercialSubscriptionSheetAction,
} from "@/shared/server/actions/commercial/commercial";
import { startContractCheckout } from "@/shared/server/commercial/checkout-core";
import { createCommercialPortalSession } from "@/shared/server/commercial/portal-session-core";
import { getSubscriptionSheet } from "@/shared/server/commercial/subscription-sheet-core";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const portal = jest.mocked(openPortal);
const checkout = jest.mocked(createCommercialCheckoutSession);
const PROVIDER_CUSTOMER = "cus_test_gravado_no_banco";
const KEY = "sheet-key-00000000001";

(enabled ? describe : describe.skip)("ficha de assinatura e portal do cliente", () => {
  let admin: ReturnType<typeof postgres>;
  let catalog: ReturnType<typeof drizzle>;
  const oldEnv = { ...process.env };
  const sheet = (ctx = owner) => acting(ctx, (actor) => getSubscriptionSheet(actor));
  const openFor = (contractId: string, ctx = owner) =>
    acting(ctx, (actor) => createCommercialPortalSession(actor, contractId));
  const linkProviderCustomer = (customerId: string, orgId = "org_a") =>
    admin`insert into billing_provider_customers (org_id, customer_id, provider, provider_customer_id)
      values (${orgId}, ${customerId}, 'stripe', ${PROVIDER_CUSTOMER})`;

  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages=warning`;
    await applyMigrations(admin);
    catalog = drizzle(admin);
  });
  afterAll(async () => {
    process.env = oldEnv;
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedCommercialBase(admin);
    mockStaff.mockReset();
    mockStaff.mockResolvedValue(owner);
    portal.mockReset();
    portal.mockResolvedValue({ url: "https://portal.provider.test/sessao" });
    checkout.mockReset();
    checkout.mockImplementation(async (request) => ({
      id: `cs_test_${request.checkoutId}`,
      url: `https://checkout.provider.test/c/${request.checkoutId}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    }));
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    process.env.COMMERCIAL_CATALOG_ENABLED = "true";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.test";
    process.env.STRIPE_SECRET_KEY = "sk_test_ficha";
  });

  it("owner vê a contratação com oferta, itens do snapshot e empresas", async () => {
    const contract = await contractOffer(catalog, "pgr");
    const result = await sheet();
    expect(result.contracts).toHaveLength(1);
    expect(result.contracts[0]).toMatchObject({
      id: contract.id,
      offerCode: contract.offerCode,
      offerName: contract.offerName,
      companies: [expect.objectContaining({ id: I.companyA })],
      items: [expect.objectContaining({ service: "pgr", unitAmountCents: 11100 })],
      financial: { status: null, checkoutStatus: null, cancelAtPeriodEnd: false },
      access: { state: "none" },
      availableActions: [],
    });
  });

  it("direito ativo e aplicado aparece como acesso liberado", async () => {
    const contract = await contractOffer(catalog, "pgr");
    await admin`insert into commercial_entitlements (org_id, contract_id, company_id, service, status, reason, applied)
      values ('org_a', ${contract.id}, ${I.companyA}, 'pgr', 'active', 'subscription_active', true)`;
    const [row] = (await sheet()).contracts;
    expect(row.access.state).toBe("granted");
    expect(row.access.rights).toEqual([
      { companyId: I.companyA, service: "pgr", state: "granted" },
    ]);
  });

  it("direito ativo não aplicado pela contratação aparece como legado", async () => {
    const contract = await contractOffer(catalog, "pgr");
    await admin`insert into commercial_entitlements (org_id, contract_id, company_id, service, status, reason, applied)
      values ('org_a', ${contract.id}, ${I.companyA}, 'pgr', 'active', 'subscription_active', false)`;
    expect((await sheet()).contracts[0].access.state).toBe("legacy");
  });

  it("direito inativo aparece como acesso suspenso", async () => {
    const contract = await contractOffer(catalog, "pgr");
    await admin`insert into commercial_entitlements (org_id, contract_id, company_id, service, status, reason, applied)
      values ('org_a', ${contract.id}, ${I.companyA}, 'pgr', 'inactive', 'payment_past_due', true)`;
    expect((await sheet()).contracts[0].access.state).toBe("suspended");
  });

  it("com cliente no provedor e modo de teste, oferece gerenciar no portal sem expor o id", async () => {
    const contract = await contractOffer(catalog, "pgr");
    await linkProviderCustomer(contract.customerId);
    const result = await sheet();
    expect(result.contracts[0].availableActions).toEqual(["manage_in_portal"]);
    expect(JSON.stringify(result)).not.toContain(PROVIDER_CUSTOMER);
  });

  it("sem chave de teste do provedor não há nenhuma ação", async () => {
    const contract = await contractOffer(catalog, "pgr");
    await linkProviderCustomer(contract.customerId);
    delete process.env.STRIPE_SECRET_KEY;
    expect((await sheet()).contracts[0].availableActions).toEqual([]);
  });

  it("com checkout aberto oferece retomar o pagamento", async () => {
    const contract = await contractOffer(catalog, "pgr");
    await acting(owner, (actor) =>
      startContractCheckout(actor, contract.id, { idempotencyKey: KEY }),
    );
    const [row] = (await sheet()).contracts;
    expect(row.financial.checkoutStatus).toBe("open");
    expect(row.availableActions).toEqual(["resume_checkout"]);
  });

  it("collaborator e client recebem FORBIDDEN", async () => {
    await contractOffer(catalog, "pgr");
    expect(await errorCode(() => sheet(collaborator))).toBe("FORBIDDEN");
    expect(await errorCode(() => sheet(clientUser))).toBe("FORBIDDEN");
  });

  it("outro escritório não vê a contratação alheia", async () => {
    await contractOffer(catalog, "pgr");
    expect((await sheet(outsider)).contracts).toEqual([]);
  });

  it("flag desligada responde FORBIDDEN na action, na rota e no núcleo", async () => {
    process.env.COMMERCIAL_CATALOG_ENABLED = "false";
    expect(await getCommercialSubscriptionSheetAction()).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(await createCommercialPortalSessionAction(UNKNOWN_ID)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    const response = await sheetRoute.GET(
      devRequest("/api/v1/commercial-subscription-sheet", "GET"),
    );
    expect(response.status).toBe(403);
    expect(await errorCode(() => openFor(UNKNOWN_ID))).toBe("FORBIDDEN");
    expect(portal).not.toHaveBeenCalled();
  });

  it("portal: usa o cliente do provedor gravado no banco e volta para a ficha", async () => {
    const contract = await contractOffer(catalog, "pgr");
    await linkProviderCustomer(contract.customerId);
    expect(await openFor(contract.id)).toEqual({
      url: "https://portal.provider.test/sessao",
    });
    expect(portal).toHaveBeenCalledTimes(1);
    expect(portal).toHaveBeenCalledWith(
      PROVIDER_CUSTOMER,
      "https://app.test/plans/subscription",
    );
  });

  it("portal: contratação de outro escritório é NOT_FOUND e não chama o provedor", async () => {
    const contract = await contractOffer(catalog, "pgr");
    await linkProviderCustomer(contract.customerId);
    expect(await errorCode(() => openFor(contract.id, outsider))).toBe("NOT_FOUND");
    expect(await errorCode(() => openFor(UNKNOWN_ID))).toBe("NOT_FOUND");
    expect(portal).not.toHaveBeenCalled();
  });

  it("portal: sem cliente no provedor é VALIDATION", async () => {
    const contract = await contractOffer(catalog, "pgr");
    expect(await errorCode(() => openFor(contract.id))).toBe("VALIDATION");
    expect(portal).not.toHaveBeenCalled();
  });

  it("portal: sem chave de teste do provedor é BILLING_UNAVAILABLE", async () => {
    const contract = await contractOffer(catalog, "pgr");
    await linkProviderCustomer(contract.customerId);
    delete process.env.STRIPE_SECRET_KEY;
    expect(await errorCode(() => openFor(contract.id))).toBe("BILLING_UNAVAILABLE");
    process.env.STRIPE_SECRET_KEY = "sk_live_nao_e_teste";
    expect(await errorCode(() => openFor(contract.id))).toBe("BILLING_UNAVAILABLE");
    expect(portal).not.toHaveBeenCalled();
  });

  it("portal: collaborator e client recebem FORBIDDEN", async () => {
    const contract = await contractOffer(catalog, "pgr");
    await linkProviderCustomer(contract.customerId);
    expect(await errorCode(() => openFor(contract.id, collaborator))).toBe("FORBIDDEN");
    expect(await errorCode(() => openFor(contract.id, clientUser))).toBe("FORBIDDEN");
    expect(portal).not.toHaveBeenCalled();
  });

  it("portal: id de contratação inválido é VALIDATION", async () => {
    expect(await errorCode(() => openFor("nao-e-uuid"))).toBe("VALIDATION");
  });

  it("rotas REST: ficha, portal, e os mapeamentos de erro", async () => {
    const contract = await contractOffer(catalog, "pgr");
    await linkProviderCustomer(contract.customerId);
    const listed = await sheetRoute.GET(
      devRequest("/api/v1/commercial-subscription-sheet", "GET"),
    );
    expect(listed.status).toBe(200);
    const body: { contracts: { id: string }[] } = await listed.json();
    expect(body.contracts.map((row) => row.id)).toEqual([contract.id]);

    const path = `/api/v1/commercial-contracts/${contract.id}/portal-session`;
    const opened = await portalRoute.POST(
      devRequest(path, "POST"),
      routeParams(contract.id),
    );
    expect(opened.status).toBe(200);
    expect(await opened.json()).toEqual({ url: "https://portal.provider.test/sessao" });

    const foreign = await portalRoute.POST(
      devRequest(path, "POST", undefined, "owner", "org_b"),
      routeParams(contract.id),
    );
    expect(foreign.status).toBe(404);
    const denied = await portalRoute.POST(
      devRequest(path, "POST", undefined, "collaborator"),
      routeParams(contract.id),
    );
    expect(denied.status).toBe(403);
    const deniedSheet = await sheetRoute.GET(
      devRequest("/api/v1/commercial-subscription-sheet", "GET", undefined, "client"),
    );
    expect(deniedSheet.status).toBe(403);
  });

  it("action do portal devolve só a URL temporária", async () => {
    const contract = await contractOffer(catalog, "pgr");
    await linkProviderCustomer(contract.customerId);
    mockStaff.mockResolvedValue(owner);
    expect(await createCommercialPortalSessionAction(contract.id)).toEqual({
      ok: true,
      data: { url: "https://portal.provider.test/sessao" },
    });
  });
});
