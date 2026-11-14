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
  createProCheckoutSession: jest.fn(),
  createBillingPortalSession: jest.fn(),
  constructWebhookEvent: jest.fn(),
}));
jest.mock("@/shared/db/repositories/orgs", () => ({
  getOrgById: jest.fn(),
  getOrgByStripeCustomerId: jest.fn(),
  updateOrgBilling: jest.fn(),
}));

import { adminClient, applyMigrations } from "../_helpers/db";
import { PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  OTHER_COMPANY,
  UNKNOWN_ID,
  acting,
  checkoutCompletedEvent,
  clientUser,
  collaborator,
  contractFor,
  contractOffer,
  devRequest,
  enabledModules,
  errorCode,
  licenses,
  outsider,
  owner,
  priceId,
  providerEvent,
  publishOffer,
  registerOffice,
  routeParams,
  seedCommercialBase,
  subscriptionEvent,
  type CheckoutRef,
} from "../_helpers/commercial-seed";
import { BillingUnavailableError } from "@/shared/errors/billing-unavailable-error";
import * as orgs from "@/shared/db/repositories/orgs";
import {
  constructWebhookEvent,
  createCommercialCheckoutSession,
  type CommercialCheckoutRequest,
} from "@/shared/integrations/stripe/client";
import {
  createCommercialOneOffOrderAction,
  getCommercialOneOffAuthorizationAction,
} from "@/shared/server/actions/commercial/commercial";
import { startContractCheckout } from "@/shared/server/commercial/checkout-core";
import * as oneOff from "@/shared/server/commercial/one-off-order-core";
import * as ordersRoute from "@/app/api/v1/commercial-one-off-orders/route";
import * as orderRoute from "@/app/api/v1/commercial-one-off-orders/[id]/route";
import * as authorizationRoute from "@/app/api/v1/commercial-one-off-orders/[id]/authorization/route";
import * as webhook from "@/app/api/webhooks/stripe/route";

const enabled = !!process.env.INTEGRATION_APP_RUNTIME_URL;
const provider = jest.mocked(createCommercialCheckoutSession);
const construct = jest.mocked(constructWebhookEvent);
const legacyLookup = jest.mocked(orgs.getOrgByStripeCustomerId);
const KEY = "one-off-key-00000001";
const OTHER_KEY = "one-off-key-00000002";
const BASE = "/api/v1/commercial-one-off-orders";

(enabled ? describe : describe.skip)(
  "pedido avulso: contratação, cobrança e autorização",
  () => {
    let admin: ReturnType<typeof postgres>;
    let runtime: ReturnType<typeof postgres>;
    let catalog: ReturnType<typeof drizzle>;
    const oldEnv = { ...process.env };

    const asRuntime = (orgId: string, userId: string | null, statement: string) =>
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org',${orgId},true), set_config('app.current_actor',${userId ?? ""},true)`;
        return tx.unsafe(statement);
      });
    const deliver = async (event: unknown) => {
      construct.mockImplementation(() => JSON.parse(JSON.stringify(event)));
      const response = await webhook.POST(
        new Request("http://localhost/api/webhooks/stripe", {
          method: "POST",
          body: JSON.stringify(event),
          headers: { "stripe-signature": "t=1,v1=test" },
        }),
      );
      return response.status;
    };
    const ensureOffice = async () => {
      const [{ total }] =
        await admin`select count(*)::int as total from commercial_customers`;
      if (total === 0) await registerOffice();
    };
    const createOrder = (offerId: string, companyId: string, ctx = owner) =>
      acting(ctx, (actor) => oneOff.createOneOffOrder(actor, { offerId, companyId }));
    const placeOrder = async (companyId = I.companyA) => {
      const published = await publishOffer(catalog, "oneOff");
      await ensureOffice();
      const order = await createOrder(published.id, companyId);
      return { published, order };
    };
    const openCheckout = async (contractId: string, key = KEY): Promise<CheckoutRef> => {
      const session = await acting(owner, (ctx) =>
        startContractCheckout(ctx, contractId, { idempotencyKey: key }),
      );
      return { id: session.id, providerSessionId: `cs_test_${session.id}` };
    };
    const paidEvent = (
      checkout: CheckoutRef,
      overrides: Parameters<typeof providerEvent>[2] = {},
      object: Record<string, unknown> = {},
    ) =>
      providerEvent(
        "checkout.session.completed",
        {
          id: checkout.providerSessionId,
          mode: "payment",
          payment_status: "paid",
          payment_intent: `pi_${checkout.id.slice(0, 8)}`,
          metadata: { commercialCheckoutId: checkout.id },
          client_reference_id: checkout.id,
          customer: null,
          subscription: null,
          ...object,
        },
        overrides,
      );
    const storedOrders = () =>
      admin<
        {
          id: string;
          status: string;
          company_id: string;
          provider_payment_ref: string | null;
          paid_at: Date | null;
          created_by: string;
        }[]
      >`select id, status, company_id, provider_payment_ref, paid_at, created_by
      from commercial_one_off_orders order by created_at, id`;
    const counts = async () => {
      const [row] = await admin`
      select (select count(*) from commercial_entitlements)::int as entitlements,
             (select count(*) from billing_subscriptions)::int as subscriptions,
             (select count(*) from billing_invoices)::int as invoices`;
      return row;
    };
    const billingEvents = () =>
      admin<{ type: string; outcome: string; detail: string }[]>`
      select type, outcome, detail from billing_events order by received_at, occurred_at`;

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
      jest.clearAllMocks();
      provider.mockImplementation(async (request: CommercialCheckoutRequest) => ({
        id: `cs_test_${request.checkoutId}`,
        url: `https://checkout.provider.test/c/${request.checkoutId}`,
        expiresAt: new Date(Date.now() + 86_400_000),
      }));
      legacyLookup.mockResolvedValue(null);
      process.env.APP_ENV = "local";
      process.env.DEV_API_AUTH_BYPASS = "true";
      process.env.COMMERCIAL_CATALOG_ENABLED = "true";
      process.env.NEXT_PUBLIC_APP_URL = "https://app.test";
    });

    describe("criação", () => {
      it("empresa sem assinatura cria o pedido pendente com cópia do preço", async () => {
        const { order } = await placeOrder();
        expect(order).toMatchObject({
          companyId: I.companyA,
          status: "pending",
          providerPaymentRef: null,
          paidAt: null,
          createdBy: "owner",
          offerCode: "ficticio-avulso-laudo",
        });
        const [contract] = await admin`
        select billing_period, term_end from commercial_contracts where id = ${order.contractId}`;
        expect(contract).toMatchObject({ billing_period: "one_time", term_end: null });
        const items = await admin`
        select service, unit, unit_amount_cents from commercial_contract_items
        where contract_id = ${order.contractId}`;
        expect(items).toEqual([
          { service: "one_off", unit: "company", unit_amount_cents: 44400 },
        ]);
        expect(await storedOrders()).toHaveLength(1);
        expect(await counts()).toEqual({
          entitlements: 0,
          subscriptions: 0,
          invoices: 0,
        });
      });

      it("empresa que já tem assinatura também cria o pedido, sem mexer na assinatura", async () => {
        const subscribed = await contractOffer(catalog, "pgr");
        const checkout = await openCheckout(subscribed.id, OTHER_KEY);
        expect(await deliver(checkoutCompletedEvent(checkout))).toBe(200);
        expect(await deliver(subscriptionEvent(checkout, "active"))).toBe(200);
        const before = await counts();
        const modules = await enabledModules(admin);
        expect(modules).toEqual([`${I.companyA}:pgr`]);

        const { order } = await placeOrder();
        expect(order.status).toBe("pending");
        expect(await enabledModules(admin)).toEqual(modules);
        expect(await counts()).toEqual(before);
      });

      it("cada contratação tem no máximo um pedido", async () => {
        const { order } = await placeOrder();
        await expect(
          admin`insert into commercial_one_off_orders (org_id, contract_id, company_id, created_by)
              values ('org_a', ${order.contractId}, ${I.companyA}, 'owner')`,
        ).rejects.toThrow(/uq_commercial_one_off_orders_contract/);
      });

      it("recusa oferta recorrente, oferta por escritório, cliente do escritório ausente e empresa inexistente", async () => {
        const monthly = await publishOffer(catalog, "pgr");
        const avulso = await publishOffer(catalog, "oneOff");
        expect(await errorCode(() => createOrder(avulso.id, I.companyA))).toBe(
          "VALIDATION",
        );
        await registerOffice();
        expect(await errorCode(() => createOrder(monthly.id, I.companyA))).toBe(
          "VALIDATION",
        );
        expect(await errorCode(() => createOrder(UNKNOWN_ID, I.companyA))).toBe(
          "VALIDATION",
        );
        expect(await errorCode(() => createOrder(avulso.id, UNKNOWN_ID))).toBe(
          "FK_NOT_FOUND",
        );
        expect(
          await errorCode(() =>
            acting(owner, (ctx) =>
              oneOff.createOneOffOrder(ctx, {
                offerId: avulso.id,
                companyId: I.companyA,
                amountCents: 1,
              }),
            ),
          ),
        ).toBe("VALIDATION");
        expect(await storedOrders()).toHaveLength(0);
        expect(
          await admin`select id from commercial_contracts where billing_period = 'one_time'`,
        ).toHaveLength(0);
      });
    });

    describe("checkout em pagamento único", () => {
      it("cria a sessão em modo payment com o preço do servidor, sem alvos de direito de uso", async () => {
        const { order } = await placeOrder();
        const session = await acting(owner, (ctx) =>
          startContractCheckout(ctx, order.contractId, { idempotencyKey: KEY }),
        );
        expect(session).toMatchObject({ contractId: order.contractId, status: "open" });
        expect(provider.mock.calls).toEqual([
          [
            {
              checkoutId: session.id,
              lines: [
                { position: 1, providerPriceId: priceId("oneOff", 1), quantity: 1 },
              ],
              providerCustomerId: null,
              customerEmail: "financeiro@consultoria.test",
              successUrl: "https://app.test/plans?commercial_checkout=success",
              cancelUrl: "https://app.test/plans?commercial_checkout=cancelled",
              mode: "payment",
            },
          ],
        ]);
        const [stored] =
          await admin`select targets, provider_session_id from billing_checkout_sessions`;
        expect(stored.targets).toEqual([]);
        expect(await counts()).toEqual({
          entitlements: 0,
          subscriptions: 0,
          invoices: 0,
        });
      });

      it("a mesma chave devolve a mesma sessão sem chamar o provedor de novo", async () => {
        const { order } = await placeOrder();
        const first = await openCheckout(order.contractId);
        const again = await openCheckout(order.contractId);
        expect(again).toEqual(first);
        expect(provider).toHaveBeenCalledTimes(1);
      });

      it("recusa valor vindo do cliente, contratação avulsa sem pedido e chave de produção ou ausente", async () => {
        const { order, published } = await placeOrder();
        const office = await admin`select id from commercial_customers`;
        const loose = await contractFor(office[0].id, published.id, [I.companyA]);
        expect(
          await errorCode(() =>
            acting(owner, (ctx) =>
              startContractCheckout(ctx, order.contractId, {
                idempotencyKey: KEY,
                unitAmountCents: 1,
              }),
            ),
          ),
        ).toBe("VALIDATION");
        await expect(
          acting(owner, (ctx) =>
            startContractCheckout(ctx, loose.id, { idempotencyKey: KEY }),
          ),
        ).rejects.toMatchObject({
          code: "VALIDATION",
          message: expect.stringContaining("pedido avulso"),
        });
        provider.mockRejectedValueOnce(new BillingUnavailableError());
        expect(
          await errorCode(() =>
            acting(owner, (ctx) =>
              startContractCheckout(ctx, order.contractId, { idempotencyKey: OTHER_KEY }),
            ),
          ),
        ).toBe("BILLING_UNAVAILABLE");
        const [{ total }] =
          await admin`select count(*)::int as total from billing_checkout_sessions`;
        expect(total).toBe(0);
      });

      it("pedido já pago não abre outro checkout", async () => {
        const { order } = await placeOrder();
        const checkout = await openCheckout(order.contractId);
        expect(await deliver(paidEvent(checkout))).toBe(200);
        expect(
          await errorCode(() =>
            acting(owner, (ctx) =>
              startContractCheckout(ctx, order.contractId, { idempotencyKey: OTHER_KEY }),
            ),
          ),
        ).toBe("DUPLICATE");
      });
    });

    describe("evento de pagamento", () => {
      it("o pagamento confirmado marca o pedido como pago uma única vez e repetição não muda nada", async () => {
        const { order } = await placeOrder();
        const checkout = await openCheckout(order.contractId);
        const event = paidEvent(checkout);
        expect(await deliver(event)).toBe(200);

        const [paid] = await storedOrders();
        expect(paid).toMatchObject({
          id: order.id,
          status: "paid",
          provider_payment_ref: `pi_${checkout.id.slice(0, 8)}`,
        });
        expect(paid.paid_at).not.toBeNull();
        const [session] = await admin`select status from billing_checkout_sessions`;
        expect(session.status).toBe("completed");
        expect(await billingEvents()).toEqual([
          {
            type: "checkout.session.completed",
            outcome: "applied",
            detail: "one_off_paid",
          },
        ]);

        expect(await deliver(event)).toBe(200);
        expect(await deliver(paidEvent(checkout))).toBe(200);
        expect(await storedOrders()).toEqual([paid]);
        expect(await billingEvents()).toEqual([
          {
            type: "checkout.session.completed",
            outcome: "applied",
            detail: "one_off_paid",
          },
          {
            type: "checkout.session.completed",
            outcome: "ignored",
            detail: "checkout_session_not_open",
          },
        ]);
      });

      it("pagamento assíncrono confirmado depois também baixa o pedido; sem confirmação nada muda", async () => {
        const { order } = await placeOrder();
        const checkout = await openCheckout(order.contractId);
        expect(await deliver(paidEvent(checkout, {}, { payment_status: "unpaid" }))).toBe(
          200,
        );
        expect((await storedOrders())[0].status).toBe("pending");
        expect(await billingEvents()).toHaveLength(0);

        const succeeded = providerEvent("checkout.session.async_payment_succeeded", {
          id: checkout.providerSessionId,
          mode: "payment",
          payment_status: "paid",
          payment_intent: "pi_async",
          metadata: { commercialCheckoutId: checkout.id },
        });
        expect(await deliver(succeeded)).toBe(200);
        expect(await storedOrders()).toMatchObject([
          { status: "paid", provider_payment_ref: "pi_async" },
        ]);
      });

      it("evento de produção (livemode) e flag desligada não baixam o pedido", async () => {
        const { order } = await placeOrder();
        const checkout = await openCheckout(order.contractId);
        expect(await deliver(paidEvent(checkout, { livemode: true }))).toBe(200);
        expect((await storedOrders())[0].status).toBe("pending");

        delete process.env.COMMERCIAL_CATALOG_ENABLED;
        expect(await deliver(paidEvent(checkout))).toBe(200);
        expect((await storedOrders())[0].status).toBe("pending");
        expect(await billingEvents()).toHaveLength(0);
        expect(orgs.updateOrgBilling).not.toHaveBeenCalled();
      });

      it("o escritório vem do vínculo do checkout, não do org_id do evento", async () => {
        const { order } = await placeOrder();
        const checkout = await openCheckout(order.contractId);
        const forged = paidEvent(
          checkout,
          {},
          { metadata: { commercialCheckoutId: checkout.id, orgId: "org_b" } },
        );
        expect(await deliver(forged)).toBe(200);
        expect(await storedOrders()).toMatchObject([{ id: order.id, status: "paid" }]);
        const events = await admin`select org_id from billing_events`;
        expect(events).toEqual([{ org_id: "org_a" }]);
      });

      it("pedido pago não liga módulo, não altera o plano e não cria direito, assinatura ou fatura", async () => {
        const { order } = await placeOrder();
        const before = await licenses(admin);
        const checkout = await openCheckout(order.contractId);
        expect(await deliver(paidEvent(checkout))).toBe(200);
        expect((await storedOrders())[0].status).toBe("paid");
        expect(await licenses(admin)).toEqual(before);
        expect(await enabledModules(admin)).toEqual([]);
        expect(await counts()).toEqual({
          entitlements: 0,
          subscriptions: 0,
          invoices: 0,
        });
        const [{ plan }] = await admin`select plan from orgs where id = 'org_a'`;
        expect(plan).toBe("free");
      });

      it("o banco só deixa o webhook gravar o pagamento e só o administrador criar o pedido em seu nome", async () => {
        const { order, published } = await placeOrder();
        const office = await admin`select id from commercial_customers`;
        const second = await contractFor(office[0].id, published.id, [OTHER_COMPANY]);
        const insert = (author: string) =>
          `insert into commercial_one_off_orders (org_id, contract_id, company_id, created_by)
         values ('org_a', '${second.id}', '${OTHER_COMPANY}', '${author}')`;
        await expect(
          asRuntime("org_a", "collab", insert("collab")),
        ).rejects.toMatchObject({
          code: "42501",
        });
        await expect(asRuntime("org_a", "owner", insert("collab"))).rejects.toMatchObject(
          {
            code: "42501",
          },
        );
        expect((await asRuntime("org_a", "owner", insert("owner"))).count).toBe(1);

        const forge = `update commercial_one_off_orders set status = 'paid', paid_at = now() where id = '${order.id}'`;
        expect((await asRuntime("org_a", "owner", forge)).count).toBe(0);
        expect((await asRuntime("org_b", null, forge)).count).toBe(0);
        expect((await storedOrders()).find((row) => row.id === order.id)?.status).toBe(
          "pending",
        );
        expect((await asRuntime("org_a", null, forge)).count).toBe(1);
        await expect(
          asRuntime("org_a", "owner", `delete from commercial_one_off_orders`),
        ).rejects.toMatchObject({ code: "42501" });
      });
    });

    describe("autorização para os consumidores", () => {
      it("só o pedido pago da própria empresa autoriza; o de uma empresa não autoriza outra", async () => {
        const { order } = await placeOrder();
        const requirePurchased = (companyId: string, ctx = owner) =>
          errorCode(() =>
            acting(ctx, (actor) =>
              oneOff.requirePurchasedOneOff(actor, order.id, companyId),
            ),
          );
        expect(await requirePurchased(I.companyA)).toBe("PAYMENT_REQUIRED");

        const checkout = await openCheckout(order.contractId);
        expect(await deliver(paidEvent(checkout))).toBe(200);

        expect(await requirePurchased(I.companyA)).toBe("resolved");
        expect(await requirePurchased(OTHER_COMPANY)).toBe("PAYMENT_REQUIRED");
        expect(await requirePurchased(I.companyA, collaborator)).toBe("resolved");
        expect(await requirePurchased(I.companyA, clientUser)).toBe("FORBIDDEN");
        expect(
          await acting(owner, (ctx) =>
            oneOff.isOneOffPurchased(ctx, order.id, I.companyA),
          ),
        ).toBe(true);
        expect(
          await acting(owner, (ctx) =>
            oneOff.isOneOffPurchased(ctx, order.id, OTHER_COMPANY),
          ),
        ).toBe(false);
        expect(await requirePurchased(I.companyA, outsider)).toBe("NOT_FOUND");
      });

      it("pedido de outro escritório não aparece: NOT_FOUND na leitura e lista vazia", async () => {
        const { order } = await placeOrder();
        expect(
          await errorCode(() =>
            acting(outsider, (ctx) => oneOff.getOneOffOrder(ctx, order.id)),
          ),
        ).toBe("NOT_FOUND");
        expect(
          await errorCode(() =>
            acting(outsider, (ctx) => oneOff.getOneOffAuthorization(ctx, order.id)),
          ),
        ).toBe("NOT_FOUND");
        expect(await acting(outsider, (ctx) => oneOff.listOneOffOrders(ctx, {}))).toEqual(
          {
            rows: [],
            total: 0,
          },
        );
        expect(
          await asRuntime("org_b", "owner_b", "select id from commercial_one_off_orders"),
        ).toHaveLength(0);
      });

      it("owner gerencia, collaborator só consulta a autorização e client recebe FORBIDDEN", async () => {
        const { published, order } = await placeOrder();
        for (const ctx of [collaborator, clientUser]) {
          expect(await errorCode(() => createOrder(published.id, I.companyA, ctx))).toBe(
            "FORBIDDEN",
          );
          expect(
            await errorCode(() =>
              acting(ctx, (actor) => oneOff.listOneOffOrders(actor, {})),
            ),
          ).toBe("FORBIDDEN");
          expect(
            await errorCode(() =>
              acting(ctx, (actor) => oneOff.getOneOffOrder(actor, order.id)),
            ),
          ).toBe("FORBIDDEN");
        }
        const consult = await acting(collaborator, (ctx) =>
          oneOff.getOneOffAuthorization(ctx, order.id),
        );
        expect(consult).toEqual({
          orderId: order.id,
          companyId: I.companyA,
          status: "pending",
          purchased: false,
        });
        expect(
          await errorCode(() =>
            acting(clientUser, (ctx) => oneOff.getOneOffAuthorization(ctx, order.id)),
          ),
        ).toBe("FORBIDDEN");
        expect(
          await acting(owner, (ctx) =>
            oneOff.getOneOffAuthorization(ctx, order.id, OTHER_COMPANY),
          ),
        ).toMatchObject({ purchased: false });
      });
    });

    describe("REST e Server Actions", () => {
      it("REST cria, lista com filtros, lê e consulta a autorização", async () => {
        const published = await publishOffer(catalog, "oneOff");
        await registerOffice();
        const created = await ordersRoute.POST(
          devRequest(BASE, "POST", { offerId: published.id, companyId: I.companyA }),
        );
        expect(created.status).toBe(201);
        const order: { id: string; contractId: string; status: string } =
          await created.json();
        expect(order.status).toBe("pending");

        const list = await ordersRoute.GET(
          devRequest(
            `${BASE}?companyId=${I.companyA}&status=pending&page=1&pageSize=10`,
            "GET",
          ),
        );
        expect(list.status).toBe(200);
        expect(await list.json()).toMatchObject({ total: 1, rows: [{ id: order.id }] });
        const none = await ordersRoute.GET(
          devRequest(`${BASE}?companyId=${OTHER_COMPANY}`, "GET"),
        );
        expect(await none.json()).toEqual({ rows: [], total: 0 });
        const paid = await ordersRoute.GET(devRequest(`${BASE}?status=paid`, "GET"));
        expect(await paid.json()).toEqual({ rows: [], total: 0 });
        const invalid = await ordersRoute.GET(
          devRequest(`${BASE}?status=refunded`, "GET"),
        );
        expect(invalid.status).toBe(422);

        const read = await orderRoute.GET(
          devRequest(`${BASE}/${order.id}`, "GET"),
          routeParams(order.id),
        );
        expect(read.status).toBe(200);
        expect(await read.json()).toMatchObject({ id: order.id, companyId: I.companyA });

        const checkout = await openCheckout(order.contractId);
        expect(await deliver(paidEvent(checkout))).toBe(200);
        const authorized = await authorizationRoute.GET(
          devRequest(
            `${BASE}/${order.id}/authorization?companyId=${I.companyA}`,
            "GET",
            undefined,
            "collaborator",
          ),
          routeParams(order.id),
        );
        expect(authorized.status).toBe(200);
        expect(await authorized.json()).toEqual({
          orderId: order.id,
          companyId: I.companyA,
          status: "paid",
          purchased: true,
        });
        const other = await authorizationRoute.GET(
          devRequest(
            `${BASE}/${order.id}/authorization?companyId=${OTHER_COMPANY}`,
            "GET",
          ),
          routeParams(order.id),
        );
        expect(await other.json()).toMatchObject({ purchased: false });
      });

      it("REST respeita papel, escritório e entrada inválida", async () => {
        const { order, published } = await placeOrder();
        const body = { offerId: published.id, companyId: I.companyA };
        const asCollaborator = await ordersRoute.POST(
          devRequest(BASE, "POST", body, "collaborator"),
        );
        expect(asCollaborator.status).toBe(403);
        const asClient = await ordersRoute.POST(devRequest(BASE, "POST", body, "client"));
        expect(asClient.status).toBe(403);
        const collaboratorList = await ordersRoute.GET(
          devRequest(BASE, "GET", undefined, "collaborator"),
        );
        expect(collaboratorList.status).toBe(403);
        const clientAuthorization = await authorizationRoute.GET(
          devRequest(`${BASE}/${order.id}/authorization`, "GET", undefined, "client"),
          routeParams(order.id),
        );
        expect(clientAuthorization.status).toBe(403);
        const foreign = await orderRoute.GET(
          devRequest(`${BASE}/${order.id}`, "GET", undefined, "owner", "org_b"),
          routeParams(order.id),
        );
        expect(foreign.status).toBe(404);
        const foreignAuthorization = await authorizationRoute.GET(
          devRequest(
            `${BASE}/${order.id}/authorization`,
            "GET",
            undefined,
            "owner",
            "org_b",
          ),
          routeParams(order.id),
        );
        expect(foreignAuthorization.status).toBe(404);
        const tampered = await ordersRoute.POST(
          devRequest(BASE, "POST", { ...body, amountCents: 1 }),
        );
        expect(tampered.status).toBe(422);
        const another = await ordersRoute.POST(devRequest(BASE, "POST", body));
        expect(another.status).toBe(201);
        expect(await storedOrders()).toHaveLength(2);
      });

      it("Server Actions criam o pedido e consultam a autorização", async () => {
        const published = await publishOffer(catalog, "oneOff");
        await registerOffice();
        const created = await createCommercialOneOffOrderAction({
          offerId: published.id,
          companyId: I.companyA,
        });
        expect(created).toMatchObject({ ok: true, data: { status: "pending" } });
        const id = created.ok ? created.data.id : UNKNOWN_ID;
        expect(await getCommercialOneOffAuthorizationAction(id)).toMatchObject({
          ok: true,
          data: { purchased: false },
        });
        mockStaff.mockResolvedValue(collaborator);
        expect(
          await createCommercialOneOffOrderAction({
            offerId: published.id,
            companyId: I.companyA,
          }),
        ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
        expect(await getCommercialOneOffAuthorizationAction(id)).toMatchObject({
          ok: true,
        });
      });

      it("com a flag desligada tudo responde FORBIDDEN e nada é gravado", async () => {
        const { order, published } = await placeOrder();
        delete process.env.COMMERCIAL_CATALOG_ENABLED;
        expect(await errorCode(() => createOrder(published.id, OTHER_COMPANY))).toBe(
          "FORBIDDEN",
        );
        expect(
          await errorCode(() => acting(owner, (ctx) => oneOff.listOneOffOrders(ctx, {}))),
        ).toBe("FORBIDDEN");
        expect(
          await errorCode(() =>
            acting(collaborator, (ctx) => oneOff.getOneOffAuthorization(ctx, order.id)),
          ),
        ).toBe("FORBIDDEN");
        expect(
          await errorCode(() =>
            acting(owner, (ctx) =>
              oneOff.requirePurchasedOneOff(ctx, order.id, I.companyA),
            ),
          ),
        ).toBe("FORBIDDEN");
        const response = await ordersRoute.POST(
          devRequest(BASE, "POST", { offerId: published.id, companyId: OTHER_COMPANY }),
        );
        expect(response.status).toBe(403);
        expect(await storedOrders()).toHaveLength(1);
      });
    });
  },
);
