import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

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
}));

import { adminClient, applyMigrations } from "../_helpers/db";
import { PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  OFFERS,
  OTHER_COMPANY,
  UNKNOWN_ID,
  acting,
  clientUser,
  collaborator,
  contractFor,
  contractOffer,
  devRequest,
  errorCode,
  licenses,
  outsider,
  owner,
  priceId,
  publishOffer,
  registerOffice,
  routeParams,
  seedCommercialBase,
} from "../_helpers/commercial-seed";
import {
  createOfferVersion,
  mapProviderPrice,
  publishOfferVersion,
  runCatalogCommand,
} from "@/shared/db/repositories/commercial-catalog-admin";
import { BillingUnavailableError } from "@/shared/errors/billing-unavailable-error";
import {
  createCommercialCheckoutSession,
  type CommercialCheckoutRequest,
} from "@/shared/integrations/stripe/client";
import { startCommercialCheckoutAction } from "@/shared/server/actions/commercial/commercial";
import { startContractCheckout } from "@/shared/server/commercial/checkout-core";
import * as checkoutRoute from "@/app/api/v1/commercial-contracts/[id]/checkout/route";

const enabled = !!process.env.INTEGRATION_APP_RUNTIME_URL;
const provider = jest.mocked(createCommercialCheckoutSession);
const KEY = "checkout-key-0000001";
const OTHER_KEY = "checkout-key-0000002";

(enabled ? describe : describe.skip)("checkout hospedado por contratação", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  let catalog: ReturnType<typeof drizzle>;
  const oldEnv = { ...process.env };

  const asRuntime = (orgId: string, userId: string | null, statement: string) =>
    runtime.begin(async (tx) => {
      await tx`select set_config('app.current_org',${orgId},true), set_config('app.current_actor',${userId ?? ""},true)`;
      return tx.unsafe(statement);
    });
  const checkout = (contractId: string, input: unknown, ctx = owner) =>
    acting(ctx, (actor) => startContractCheckout(actor, contractId, input));
  const stored = () =>
    admin`select id, org_id, contract_id, idempotency_key, provider_session_id, status, created_by, targets
          from billing_checkout_sessions order by created_at, id`;

  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages=warning`;
    await applyMigrations(admin);
    catalog = drizzle(admin);
    runtime = postgres(String(process.env.INTEGRATION_APP_RUNTIME_URL), {
      max: 1,
      prepare: false,
    });
  });
  afterAll(async () => {
    process.env = oldEnv;
    await runtime.end({ timeout: 5 });
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedCommercialBase(admin);
    mockStaff.mockReset();
    mockStaff.mockResolvedValue(owner);
    provider.mockReset();
    provider.mockImplementation(async (request: CommercialCheckoutRequest) => ({
      id: `cs_test_${request.checkoutId}`,
      url: `https://checkout.provider.test/c/${request.checkoutId}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    }));
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    process.env.COMMERCIAL_CATALOG_ENABLED = "true";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.test";
  });

  it("cria a sessão com os preços do provedor resolvidos no servidor e a quantidade de empresas da contratação", async () => {
    const contract = await contractOffer(catalog, "both", [I.companyA, OTHER_COMPANY]);
    const session = await checkout(contract.id, { idempotencyKey: KEY });

    expect(session).toMatchObject({ contractId: contract.id, status: "open" });
    expect(session.url).toBe(`https://checkout.provider.test/c/${session.id}`);
    expect(provider.mock.calls).toEqual([
      [
        {
          checkoutId: session.id,
          lines: [
            { position: 1, providerPriceId: priceId("both", 1), quantity: 2 },
            { position: 2, providerPriceId: priceId("both", 2), quantity: 2 },
          ],
          providerCustomerId: null,
          customerEmail: "financeiro@consultoria.test",
          successUrl: "https://app.test/plans?commercial_checkout=success",
          cancelUrl: "https://app.test/plans?commercial_checkout=cancelled",
        },
      ],
    ]);
    expect(await stored()).toEqual([
      {
        id: session.id,
        org_id: "org_a",
        contract_id: contract.id,
        idempotency_key: KEY,
        provider_session_id: `cs_test_${session.id}`,
        status: "open",
        created_by: "owner",
        targets: [
          { companyId: I.companyA, service: "medicine" },
          { companyId: OTHER_COMPANY, service: "medicine" },
          { companyId: I.companyA, service: "pgr" },
          { companyId: OTHER_COMPANY, service: "pgr" },
        ],
      },
    ]);
  });

  it("recusa valor, preço, quantidade e URL de retorno vindos do cliente", async () => {
    const contract = await contractOffer(catalog, "pgr");
    const tampered = [
      { idempotencyKey: KEY, unitAmountCents: 1 },
      { idempotencyKey: KEY, priceId: "price_cheap" },
      { idempotencyKey: KEY, quantity: 0 },
      { idempotencyKey: KEY, successUrl: "https://evil.test" },
      { idempotencyKey: "curta" },
      {},
    ];
    for (const input of tampered)
      expect(await errorCode(() => checkout(contract.id, input))).toBe("VALIDATION");
    expect(provider).not.toHaveBeenCalled();
    expect(await stored()).toHaveLength(0);
  });

  it("a mesma chave devolve a mesma sessão sem chamar o provedor de novo, inclusive em paralelo", async () => {
    const contract = await contractOffer(catalog, "pgr");
    const first = await checkout(contract.id, { idempotencyKey: KEY });
    const again = await checkout(contract.id, { idempotencyKey: KEY });
    expect(again).toEqual(first);
    expect(provider).toHaveBeenCalledTimes(1);

    const medicine = await publishOffer(catalog, "medicine");
    const [{ id: office }] = await admin`select id from commercial_customers`;
    const second = await contractFor(office, medicine.id, [I.companyA]);
    const parallel = await Promise.all([
      checkout(second.id, { idempotencyKey: OTHER_KEY }),
      checkout(second.id, { idempotencyKey: OTHER_KEY }),
    ]);
    expect(parallel[0]).toEqual(parallel[1]);
    expect(new Set(provider.mock.calls.map(([request]) => request.checkoutId)).size).toBe(
      2,
    );
    expect(await stored()).toHaveLength(2);
  });

  it("a mesma chave em outra contratação é recusada e outra chave não abre segundo checkout enquanto o primeiro está aberto", async () => {
    const contract = await contractOffer(catalog, "pgr");
    const medicine = await publishOffer(catalog, "medicine");
    const [{ id: office }] = await admin`select id from commercial_customers`;
    const other = await contractFor(office, medicine.id, [I.companyA]);
    const first = await checkout(contract.id, { idempotencyKey: KEY });

    expect(await errorCode(() => checkout(other.id, { idempotencyKey: KEY }))).toBe(
      "VALIDATION",
    );
    expect(
      await errorCode(() => checkout(contract.id, { idempotencyKey: OTHER_KEY })),
    ).toBe("DUPLICATE");
    expect(provider).toHaveBeenCalledTimes(1);

    await admin`update billing_checkout_sessions set expires_at = now() - interval '1 minute'`;
    const renewed = await checkout(contract.id, { idempotencyKey: OTHER_KEY });
    expect(renewed.id).not.toBe(first.id);
    expect(await stored()).toHaveLength(2);
  });

  it("contratação que já tem assinatura no provedor não abre outro checkout", async () => {
    const contract = await contractOffer(catalog, "pgr");
    await admin`insert into billing_subscriptions (org_id, contract_id, provider, provider_subscription_id, status)
                values ('org_a', ${contract.id}, 'stripe', 'sub_1', 'active')`;
    expect(await errorCode(() => checkout(contract.id, { idempotencyKey: KEY }))).toBe(
      "DUPLICATE",
    );
    expect(provider).not.toHaveBeenCalled();
  });

  it("sem preço cadastrado no provedor o checkout é recusado com o item que falta", async () => {
    const offer = await publishOffer(catalog, "both", { mapped: false });
    await mapProviderPrice(
      catalog,
      { offerVersionId: offer.id, position: 1, providerPriceId: "price_onlyfirst" },
      "operador",
    );
    const office = await registerOffice();
    const contract = await contractFor(office.id, offer.id, [I.companyA]);

    await expect(checkout(contract.id, { idempotencyKey: KEY })).rejects.toMatchObject({
      code: "VALIDATION",
      message:
        'O item "Medicina por empresa" não tem preço cadastrado no provedor de pagamento.',
    });
    expect(provider).not.toHaveBeenCalled();
    expect(await stored()).toHaveLength(0);
  });

  it("recusa unidade sem regra de quantidade, contratação avulsa e catálogo fictício em produção", async () => {
    const office = await registerOffice();
    const publish = async (input: (typeof OFFERS)["pgr"]) => {
      const created = await createOfferVersion(catalog, input, "operador");
      await publishOfferVersion(catalog, created.id, "operador");
      await mapProviderPrice(
        catalog,
        {
          offerVersionId: created.id,
          position: 1,
          providerPriceId: `price_${input.code.replaceAll("-", "")}`,
        },
        "operador",
      );
      return contractFor(office.id, created.id, [I.companyA]);
    };
    const perEmployee = await publish({
      ...OFFERS.pgr,
      code: "ficticio-por-funcionario",
      items: [{ ...OFFERS.pgr.items[0], unit: "employee" }],
    });
    const oneTime = await publish({
      ...OFFERS.pgr,
      code: "ficticio-avulso",
      billingPeriod: "one_time",
    });
    const monthly = await publish(OFFERS.pgr);

    await expect(checkout(perEmployee.id, { idempotencyKey: KEY })).rejects.toMatchObject(
      { code: "VALIDATION", message: expect.stringContaining("regra comercial") },
    );
    await expect(checkout(oneTime.id, { idempotencyKey: KEY })).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringContaining("NOB-117"),
    });
    process.env.APP_ENV = "production";
    await expect(checkout(monthly.id, { idempotencyKey: KEY })).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringContaining("fictício"),
    });
    expect(provider).not.toHaveBeenCalled();
  });

  it("falha do provedor não grava sessão e a mesma chave pode ser repetida depois", async () => {
    const contract = await contractOffer(catalog, "pgr");
    provider.mockRejectedValueOnce(new BillingUnavailableError());
    expect(await errorCode(() => checkout(contract.id, { idempotencyKey: KEY }))).toBe(
      "BILLING_UNAVAILABLE",
    );
    expect(await stored()).toHaveLength(0);

    const session = await checkout(contract.id, { idempotencyKey: KEY });
    expect(session.status).toBe("open");
    expect(provider.mock.calls[0][0].checkoutId).toBe(
      provider.mock.calls[1][0].checkoutId,
    );
  });

  it("abrir o checkout não altera plano, dados do Stripe do escritório nem serviços por empresa", async () => {
    const contract = await contractOffer(catalog, "both");
    const before = await licenses(admin);
    await checkout(contract.id, { idempotencyKey: KEY });
    expect(await licenses(admin)).toEqual(before);
    const [{ total }] = await admin`
      select (select count(*) from billing_subscriptions) + (select count(*) from commercial_entitlements)
           + (select count(*) from billing_events) + (select count(*) from billing_invoices) as total`;
    expect(Number(total)).toBe(0);
  });

  it("colaborador e cliente recebem FORBIDDEN; outra organização não encontra a contratação nem enxerga a sessão", async () => {
    const contract = await contractOffer(catalog, "pgr");
    for (const ctx of [collaborator, clientUser])
      expect(
        await errorCode(() => checkout(contract.id, { idempotencyKey: KEY }, ctx)),
      ).toBe("FORBIDDEN");
    expect(
      await errorCode(() => checkout(contract.id, { idempotencyKey: KEY }, outsider)),
    ).toBe("NOT_FOUND");
    expect(provider).not.toHaveBeenCalled();

    await checkout(contract.id, { idempotencyKey: KEY });
    const foreign = await asRuntime(
      "org_b",
      "owner_b",
      "select id from billing_checkout_sessions",
    );
    expect(foreign).toHaveLength(0);
    const sameKeyElsewhere = await errorCode(() =>
      checkout(UNKNOWN_ID, { idempotencyKey: KEY }, outsider),
    );
    expect(sameKeyElsewhere).toBe("NOT_FOUND");
  });

  it("o banco só aceita sessão criada pelo administrador em seu próprio nome e não deixa a sessão de usuário mudar o estado", async () => {
    const contract = await contractOffer(catalog, "pgr");
    const insert = (id: string, author: string) =>
      `insert into billing_checkout_sessions (id, org_id, contract_id, customer_id, targets, provider, idempotency_key, provider_session_id, url, expires_at, created_by)
       values ('${id}', 'org_a', '${contract.id}', '${contract.customerId}', '[]', 'stripe', 'k-${id}', 'cs_${id}', 'https://x.test', now() + interval '1 day', '${author}')`;
    const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
    const B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
    await expect(asRuntime("org_a", "collab", insert(A, "collab"))).rejects.toMatchObject(
      { code: "42501" },
    );
    await expect(asRuntime("org_a", "owner", insert(A, "collab"))).rejects.toMatchObject({
      code: "42501",
    });
    await expect(asRuntime("org_a", null, insert(A, "owner"))).rejects.toMatchObject({
      code: "42501",
    });
    await asRuntime("org_a", "owner", insert(B, "owner"));
    const completed = await asRuntime(
      "org_a",
      "owner",
      `update billing_checkout_sessions set status = 'completed' where id = '${B}'`,
    );
    expect(completed.count).toBe(0);
    await expect(
      asRuntime(
        "org_a",
        "owner",
        `delete from billing_checkout_sessions where id = '${B}'`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asRuntime(
        "org_a",
        null,
        `update billing_checkout_sessions set url = 'https://evil.test' where id = '${B}'`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("o mapeamento de preço é do operador: o comando grava e troca; o runtime só lê", async () => {
    const offer = await publishOffer(catalog, "pgr", { mapped: false });
    const context = {
      env: { APP_ENV: "local" },
      operator: "operador",
      readJsonFile: async () => ({}),
    };
    const command = (providerPriceId: string, position = 1) =>
      runCatalogCommand(
        catalog,
        { kind: "map-price", id: offer.id, position, providerPriceId },
        context,
      );
    expect(await command("price_first01")).toMatchObject({
      providerPriceId: "price_first01",
    });
    expect(await command("price_second2")).toMatchObject({
      providerPriceId: "price_second2",
    });
    await expect(command("price_missing", 9)).rejects.toMatchObject({
      reason: "item_not_found",
    });
    expect(
      await admin`select provider, provider_price_id, mapped_by from billing_provider_prices`,
    ).toEqual([
      { provider: "stripe", provider_price_id: "price_second2", mapped_by: "operador" },
    ]);
    const visible = await asRuntime(
      "org_a",
      "collab",
      "select provider_price_id from billing_provider_prices",
    );
    expect(visible).toHaveLength(1);
    for (const statement of [
      "update billing_provider_prices set provider_price_id = 'price_cheap00'",
      "delete from billing_provider_prices",
      `insert into billing_provider_prices (provider, offer_item_id, provider_price_id, mapped_by)
         select 'stripe', id, 'price_forged0', 'owner' from commercial_offer_items limit 1`,
    ])
      await expect(asRuntime("org_a", "owner", statement)).rejects.toMatchObject({
        code: "42501",
      });
  });

  it("com a flag desligada o checkout responde FORBIDDEN, não chama o provedor e não grava", async () => {
    const contract = await contractOffer(catalog, "pgr");
    delete process.env.COMMERCIAL_CATALOG_ENABLED;
    expect(await errorCode(() => checkout(contract.id, { idempotencyKey: KEY }))).toBe(
      "FORBIDDEN",
    );
    const response = await checkoutRoute.POST(
      devRequest(`/api/v1/commercial-contracts/${contract.id}/checkout`, "POST", {
        idempotencyKey: KEY,
      }),
      routeParams(contract.id),
    );
    expect(response.status).toBe(403);
    expect(provider).not.toHaveBeenCalled();
    expect(await stored()).toHaveLength(0);
  });

  it("REST e Server Action abrem o mesmo checkout e respeitam papel e escritório", async () => {
    const contract = await contractOffer(catalog, "pgr");
    const path = `/api/v1/commercial-contracts/${contract.id}/checkout`;
    const created = await checkoutRoute.POST(
      devRequest(path, "POST", { idempotencyKey: KEY }),
      routeParams(contract.id),
    );
    expect(created.status).toBe(201);
    const session: { id: string; url: string } = await created.json();

    const action = await startCommercialCheckoutAction(contract.id, {
      idempotencyKey: KEY,
    });
    expect(action).toMatchObject({
      ok: true,
      data: { id: session.id, url: session.url },
    });
    expect(provider).toHaveBeenCalledTimes(1);

    const invalid = await checkoutRoute.POST(
      devRequest(path, "POST", { idempotencyKey: KEY, amount: 1 }),
      routeParams(contract.id),
    );
    expect(invalid.status).toBe(422);
    const forbidden = await checkoutRoute.POST(
      devRequest(path, "POST", { idempotencyKey: OTHER_KEY }, "collaborator"),
      routeParams(contract.id),
    );
    expect(forbidden.status).toBe(403);
    const foreign = await checkoutRoute.POST(
      devRequest(path, "POST", { idempotencyKey: OTHER_KEY }, "owner", "org_b"),
      routeParams(contract.id),
    );
    expect(foreign.status).toBe(404);
    mockStaff.mockResolvedValue(collaborator);
    expect(
      await startCommercialCheckoutAction(contract.id, { idempotencyKey: OTHER_KEY }),
    ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});
