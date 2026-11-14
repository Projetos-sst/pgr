import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockMaster = jest.fn();
jest.mock("@/shared/auth/require-master", () => ({
  requireMaster: () => mockMaster(),
  requireMasterPage: () => mockMaster(),
}));
jest.mock("@/shared/integrations/stripe/client", () => ({
  createCommercialCheckoutSession: jest.fn(),
  createProCheckoutSession: jest.fn(),
  createBillingPortalSession: jest.fn(),
  constructWebhookEvent: jest.fn(),
  retrieveCommercialSubscription: jest.fn(),
}));
jest.mock("@/shared/db/repositories/orgs", () => ({
  getOrgById: jest.fn(),
  getOrgByStripeCustomerId: jest.fn(),
  updateOrgBilling: jest.fn(),
}));

import { adminClient, applyMigrations } from "../_helpers/db";
import { PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  UNKNOWN_ID,
  acting,
  checkoutCompletedEvent,
  contractFor,
  devRequest,
  enabledModules,
  errorCode,
  outsider,
  owner,
  providerIds,
  publishOffer,
  registerOffice,
  seedCommercialBase,
  subscriptionEvent,
  T0,
  type CheckoutRef,
  type OfferKey,
} from "../_helpers/commercial-seed";
import { ForbiddenError, UnauthorizedError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { withPlatformOperator } from "@/shared/db/with-platform-operator";
import { billingSubscriptions, commercialEntitlements } from "@/shared/db/schema/billing";
import { commercialContracts } from "@/shared/db/schema/commercial";
import { runAsActor } from "@/shared/db/session-actor";
import type {
  SubscriptionLookup,
  AdminSubscriptionRow,
} from "@/shared/domains/commercial/admin-subscriptions";
import type { SubscriptionStatus } from "@/shared/domains/commercial/billing-model";
import {
  constructWebhookEvent,
  createCommercialCheckoutSession,
  retrieveCommercialSubscription,
  type CommercialCheckoutRequest,
} from "@/shared/integrations/stripe/client";
import {
  getAdminSubscriptionAction,
  listAdminSubscriptionsAction,
  reconcileSubscriptionAction,
} from "@/shared/server/actions/commercial/admin-subscriptions";
import {
  getAdminSubscription,
  listAdminSubscriptions,
  reconcileSubscription,
} from "@/shared/server/commercial/admin-subscriptions-core";
import { startContractCheckout } from "@/shared/server/commercial/checkout-core";
import * as detailRoute from "@/app/api/v1/admin/billing/subscriptions/[contractId]/route";
import * as reconcileRoute from "@/app/api/v1/admin/billing/subscriptions/[contractId]/reconcile/route";
import * as listRoute from "@/app/api/v1/admin/billing/subscriptions/route";
import * as webhook from "@/app/api/webhooks/stripe/route";

const enabled = !!process.env.INTEGRATION_APP_RUNTIME_URL;
const provider = jest.mocked(createCommercialCheckoutSession);
const construct = jest.mocked(constructWebhookEvent);
const retrieve = jest.mocked(retrieveCommercialSubscription);
const MASTER = { userId: "master_1" };
const REASON = "conferência de divergência apontada pelo suporte";
const BASE_URL = "/api/v1/admin/billing/subscriptions";
const contractParams = (contractId: string) => ({
  params: Promise.resolve({ contractId }),
});

(enabled ? describe : describe.skip)("painel administrativo de assinaturas", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  let catalog: ReturnType<typeof drizzle>;
  let keys = 0;
  const published = new Map<OfferKey, Awaited<ReturnType<typeof publishOffer>>>();
  const oldEnv = { ...process.env };

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
  const offerOf = async (key: OfferKey) => {
    const existing = published.get(key);
    if (existing) return existing;
    const created = await publishOffer(catalog, key);
    published.set(key, created);
    return created;
  };
  const subscribeAs = async (ctx: TenantContext, key: OfferKey, companyIds: string[]) => {
    const offer = await offerOf(key);
    const office = await registerOffice(ctx);
    const contract = await contractFor(office.id, offer.id, companyIds, ctx);
    keys += 1;
    const session = await acting(ctx, (actor) =>
      startContractCheckout(actor, contract.id, {
        idempotencyKey: `admin-panel-key-${String(keys).padStart(4, "0")}`,
      }),
    );
    const checkout: CheckoutRef = {
      id: session.id,
      providerSessionId: `cs_test_${session.id}`,
    };
    return { contract, checkout };
  };
  const recent = () => ({ created: Math.floor(Date.now() / 1000) - 3600 });
  const earlier = () => ({ created: Math.floor(Date.now() / 1000) - 7200 });
  const activate = async (checkout: CheckoutRef, status = "active") => {
    expect(await deliver(checkoutCompletedEvent(checkout, earlier()))).toBe(200);
    expect(await deliver(subscriptionEvent(checkout, status, recent()))).toBe(200);
  };
  const twoOffices = async () => {
    const a = await subscribeAs(owner, "pgr", [I.companyA]);
    await activate(a.checkout);
    const b = await subscribeAs(outsider, "pro", []);
    await activate(b.checkout, "past_due");
    return { a, b };
  };
  const source = (
    checkout: CheckoutRef,
    status: SubscriptionStatus,
  ): SubscriptionLookup => ({
    ok: true,
    snapshot: {
      providerSubscriptionId: providerIds(checkout).subscription,
      providerCustomerId: providerIds(checkout).customer,
      status,
      currentPeriodStart: new Date(T0 * 1000),
      currentPeriodEnd: new Date((T0 + 2_592_000) * 1000),
      cancelAtPeriodEnd: false,
      canceledAt: null,
    },
  });
  const forceDivergence = async (contractId: string) => {
    await admin`update commercial_entitlements set status = 'inactive', reason = 'subscription_incomplete', applied = false where contract_id = ${contractId}`;
    await admin`update company_modules set enabled = false where org_id = 'org_a'`;
  };
  const rights = (contractId: string) =>
    admin<{ service: string; status: string; reason: string; applied: boolean }[]>`
      select service, status, reason, applied from commercial_entitlements
      where contract_id = ${contractId} order by company_id nulls first, service`;
  const audits = (contractId: string) =>
    admin<
      {
        org_id: string;
        operator_id: string;
        reason: string;
        result: string;
        source: string;
        detail: string;
      }[]
    >`select org_id, operator_id, reason, result, source, detail from commercial_reconciliations
      where contract_id = ${contractId} order by created_at, id`;
  const moduleEvents = async () => {
    const [row] = await admin<{ n: number }[]>`
      select count(*)::int as n from company_module_events where org_id = 'org_a'`;
    return row.n;
  };
  const planOf = async (orgId = "org_a") => {
    const [row] = await admin<
      { plan: string }[]
    >`select plan from orgs where id = ${orgId}`;
    return row.plan;
  };
  const billingRows = async () => {
    const [row] = await admin<{ sessions: number; invoices: number }[]>`
      select (select count(*)::int from billing_checkout_sessions) as sessions,
             (select count(*)::int from billing_invoices) as invoices`;
    return row;
  };
  const enableByHand = (company: string, module: string) =>
    admin`insert into company_modules (org_id, company_id, module, enabled)
          values ('org_a', ${company}, ${module}, true)
          on conflict (org_id, company_id, module) do update set enabled = true`;
  const asRuntime = (orgId: string, statement: string) =>
    runtime.begin(async (tx) => {
      await tx`select set_config('app.current_org',${orgId},true)`;
      return tx.unsafe(statement);
    });

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
    await admin`insert into users (id, email, is_master) values ('master_1', 'master@example.test', true)
                on conflict (id) do update set is_master = true`;
    published.clear();
    jest.clearAllMocks();
    mockMaster.mockReset();
    mockMaster.mockResolvedValue(MASTER);
    retrieve.mockResolvedValue({ ok: false, reason: "provider_not_configured" });
    provider.mockImplementation(async (request: CommercialCheckoutRequest) => ({
      id: `cs_test_${request.checkoutId}`,
      url: `https://checkout.provider.test/c/${request.checkoutId}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    }));
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    process.env.COMMERCIAL_CATALOG_ENABLED = "true";
  });

  describe("leitura entre escritórios", () => {
    const orgsOf = (rows: AdminSubscriptionRow[]) => rows.map((row) => row.orgId).sort();

    it("o superadmin lista assinaturas de dois escritórios com preço do snapshot e divergência", async () => {
      const { a, b } = await twoOffices();
      const page = await listAdminSubscriptions(MASTER, {});
      expect(page.total).toBe(2);
      expect(orgsOf(page.rows)).toEqual(["org_a", "org_b"]);
      const rowA = page.rows.find((row) => row.orgId === "org_a");
      expect(rowA).toMatchObject({
        contractId: a.contract.id,
        status: "active",
        divergence: "none",
        providerSubscriptionId: providerIds(a.checkout).subscription,
        items: [{ service: "pgr", unitAmountCents: 11100 }],
        lastEvent: { type: "customer.subscription.updated", outcome: "applied" },
      });
      expect(page.rows.find((row) => row.orgId === "org_b")).toMatchObject({
        contractId: b.contract.id,
        status: "past_due",
      });
    });

    it("filtra por escritório, empresa, serviço, status, período e identificador do provedor", async () => {
      const { a, b } = await twoOffices();
      const only = async (filters: Record<string, string>) =>
        orgsOf((await listAdminSubscriptions(MASTER, filters)).rows);
      expect(await only({ orgId: "org_a" })).toEqual(["org_a"]);
      expect(await only({ orgId: "org_b" })).toEqual(["org_b"]);
      expect(await only({ companyId: I.companyA })).toEqual(["org_a"]);
      expect(await only({ service: "pgr" })).toEqual(["org_a"]);
      expect(await only({ service: "pro" })).toEqual(["org_b"]);
      expect(await only({ service: "medicine" })).toEqual([]);
      expect(await only({ status: "active" })).toEqual(["org_a"]);
      expect(await only({ status: "past_due" })).toEqual(["org_b"]);
      expect(await only({ from: "2027-01-01", to: "2027-03-01" })).toEqual([
        "org_a",
        "org_b",
      ]);
      expect(await only({ from: "2027-03-01" })).toEqual([]);
      expect(await only({ to: "2027-01-01" })).toEqual([]);
      expect(await only({ search: providerIds(a.checkout).subscription })).toEqual([
        "org_a",
      ]);
      expect(
        await only({ search: providerIds(b.checkout).customer.toUpperCase() }),
      ).toEqual(["org_b"]);
    });

    it("pagina com total correto", async () => {
      await twoOffices();
      const first = await listAdminSubscriptions(MASTER, { pageSize: "1", page: "1" });
      const second = await listAdminSubscriptions(MASTER, { pageSize: "1", page: "2" });
      expect(first.total).toBe(2);
      expect(first.rows).toHaveLength(1);
      expect(second.rows).toHaveLength(1);
      expect(first.rows[0].contractId).not.toBe(second.rows[0].contractId);
    });

    it("filtro inválido é VALIDATION", async () => {
      await twoOffices();
      expect(
        await errorCode(() => listAdminSubscriptions(MASTER, { service: "x" })),
      ).toBe("VALIDATION");
    });

    it("sinaliza divergência quando o direito está inativo e o espelho ativo", async () => {
      const { a } = await twoOffices();
      await forceDivergence(a.contract.id);
      const page = await listAdminSubscriptions(MASTER, { orgId: "org_a" });
      expect(page.rows[0].divergence).toBe("entitlement_mismatch");
    });

    it("usuário sem is_master é FORBIDDEN, mesmo sendo owner do escritório", async () => {
      await twoOffices();
      const ownerOperator = { userId: owner.userId };
      expect(await errorCode(() => listAdminSubscriptions(ownerOperator, {}))).toBe(
        "FORBIDDEN",
      );
      expect(await errorCode(() => listAdminSubscriptions({ userId: "ghost" }, {}))).toBe(
        "FORBIDDEN",
      );
    });

    it("a policy do banco: operador não master não lê nenhuma linha; o master lê", async () => {
      await twoOffices();
      const count = (userId: string) =>
        withPlatformOperator(userId, async (tx) => ({
          subscriptions: (await tx.select().from(billingSubscriptions)).length,
          contracts: (await tx.select().from(commercialContracts)).length,
          rights: (await tx.select().from(commercialEntitlements)).length,
        }));
      expect(await count("owner")).toEqual({ subscriptions: 0, contracts: 0, rights: 0 });
      expect(await count("ghost")).toEqual({ subscriptions: 0, contracts: 0, rights: 0 });
      const all = await count(MASTER.userId);
      expect(all.subscriptions).toBe(2);
      expect(all.contracts).toBe(2);
      expect(all.rights).toBeGreaterThan(0);
    });

    it("o operador não escreve em billing_subscriptions nem em commercial_entitlements", async () => {
      const { a } = await twoOffices();
      const updated = await withPlatformOperator(MASTER.userId, async (tx) => ({
        subscriptions: await tx
          .update(billingSubscriptions)
          .set({ status: "canceled" })
          .returning({ id: billingSubscriptions.id }),
        rights: await tx
          .update(commercialEntitlements)
          .set({ status: "inactive" })
          .returning({ id: commercialEntitlements.id }),
      }));
      expect(updated).toEqual({ subscriptions: [], rights: [] });
      expect(await rights(a.contract.id)).toEqual([
        expect.objectContaining({ status: "active" }),
      ]);
      const [mirror] =
        await admin`select status from billing_subscriptions where contract_id = ${a.contract.id}`;
      expect(mirror.status).toBe("active");

      const insertSubscription = () =>
        withPlatformOperator(MASTER.userId, (tx) =>
          tx.insert(billingSubscriptions).values({
            orgId: "org_a",
            contractId: a.contract.id,
            provider: "stripe",
            providerSubscriptionId: "sub_forged",
            status: "active",
          }),
        );
      const insertRight = () =>
        withPlatformOperator(MASTER.userId, (tx) =>
          tx.insert(commercialEntitlements).values({
            orgId: "org_a",
            contractId: a.contract.id,
            companyId: null,
            service: "pro",
            status: "active",
            reason: "forged",
          }),
        );
      expect(await errorCode(insertSubscription)).toBe("FORBIDDEN");
      expect(await errorCode(insertRight)).toBe("FORBIDDEN");
    });

    it("flag desligada: tudo é FORBIDDEN, até para o superadmin", async () => {
      const { a } = await twoOffices();
      process.env.COMMERCIAL_CATALOG_ENABLED = "false";
      expect(await errorCode(() => listAdminSubscriptions(MASTER, {}))).toBe("FORBIDDEN");
      expect(
        await errorCode(() => getAdminSubscription(MASTER, "org_a", a.contract.id)),
      ).toBe("FORBIDDEN");
      expect(
        await errorCode(() =>
          reconcileSubscription(MASTER, {
            orgId: "org_a",
            contractId: a.contract.id,
            reason: REASON,
          }),
        ),
      ).toBe("FORBIDDEN");
      expect((await listRoute.GET(devRequest(BASE_URL, "GET"))).status).toBe(403);
    });
  });

  describe("ficha", () => {
    it("traz preço contratado, identificadores, direitos, eventos e histórico", async () => {
      const { a } = await twoOffices();
      await reconcileSubscription(MASTER, {
        orgId: "org_a",
        contractId: a.contract.id,
        reason: REASON,
      });
      const detail = await getAdminSubscription(MASTER, "org_a", a.contract.id);
      expect(detail).toMatchObject({
        orgId: "org_a",
        contractId: a.contract.id,
        items: [{ service: "pgr", unitAmountCents: 11100 }],
        subscription: {
          providerSubscriptionId: providerIds(a.checkout).subscription,
          providerCustomerId: providerIds(a.checkout).customer,
          status: "active",
        },
        divergence: "none",
      });
      expect(detail.entitlements).toMatchObject([
        { companyId: I.companyA, service: "pgr", status: "active" },
      ]);
      expect(detail.events.map((event) => event.type)).toContain(
        "customer.subscription.updated",
      );
      expect(detail.reconciliations).toMatchObject([
        { operatorId: "master_1", reason: REASON },
      ]);
    });

    it("contratação inexistente ou de outro escritório é NOT_FOUND", async () => {
      const { a } = await twoOffices();
      expect(
        await errorCode(() => getAdminSubscription(MASTER, "org_a", UNKNOWN_ID)),
      ).toBe("NOT_FOUND");
      expect(
        await errorCode(() => getAdminSubscription(MASTER, "org_b", a.contract.id)),
      ).toBe("NOT_FOUND");
    });
  });

  describe("reconciliação", () => {
    it("com a fonte disponível corrige a divergência, liga o serviço uma vez e audita", async () => {
      const { a } = await twoOffices();
      retrieve.mockResolvedValue(source(a.checkout, "active"));
      await forceDivergence(a.contract.id);
      expect(await enabledModules(admin)).toEqual([]);
      const eventsBefore = await moduleEvents();

      const outcome = await runAsActor(owner.userId, () =>
        reconcileSubscription(MASTER, {
          orgId: "org_a",
          contractId: a.contract.id,
          reason: `  ${REASON}  `,
        }),
      );

      expect(outcome).toMatchObject({ result: "corrected", source: "provider" });
      expect(await rights(a.contract.id)).toEqual([
        {
          service: "pgr",
          status: "active",
          reason: "subscription_active",
          applied: true,
        },
      ]);
      expect(await enabledModules(admin)).toEqual([`${I.companyA}:pgr`]);
      expect(await moduleEvents()).toBe(eventsBefore + 1);
      expect(await audits(a.contract.id)).toEqual([
        expect.objectContaining({
          org_id: "org_a",
          operator_id: "master_1",
          reason: REASON,
          result: "corrected",
          source: "provider",
        }),
      ]);
    });

    it("é repetível: a segunda execução grava no_change sem tocar em direitos, serviços nem plano", async () => {
      const { a } = await twoOffices();
      retrieve.mockResolvedValue(source(a.checkout, "active"));
      await forceDivergence(a.contract.id);
      const input = { orgId: "org_a", contractId: a.contract.id, reason: REASON };
      await reconcileSubscription(MASTER, input);
      const rightsAfterFirst = await rights(a.contract.id);
      const eventsAfterFirst = await moduleEvents();
      const modulesAfterFirst = await enabledModules(admin);
      const planAfterFirst = await planOf();

      const second = await reconcileSubscription(MASTER, input);

      expect(second).toMatchObject({ result: "no_change", source: "provider" });
      expect(await rights(a.contract.id)).toEqual(rightsAfterFirst);
      expect(await moduleEvents()).toBe(eventsAfterFirst);
      expect(await enabledModules(admin)).toEqual(modulesAfterFirst);
      expect(await planOf()).toBe(planAfterFirst);
      expect((await audits(a.contract.id)).map((row) => row.result)).toEqual([
        "corrected",
        "no_change",
      ]);
    });

    it("sem a fonte grava source_unavailable e mantém o acesso derivado do espelho", async () => {
      const { a } = await twoOffices();
      await forceDivergence(a.contract.id);

      const outcome = await reconcileSubscription(MASTER, {
        orgId: "org_a",
        contractId: a.contract.id,
        reason: REASON,
      });

      expect(outcome).toMatchObject({ result: "source_unavailable", source: "mirror" });
      expect(outcome.detail).toContain("provider_unavailable:provider_not_configured");
      expect(await rights(a.contract.id)).toEqual([
        expect.objectContaining({ status: "active", reason: "subscription_active" }),
      ]);
      expect(await enabledModules(admin)).toEqual([`${I.companyA}:pgr`]);
      const [mirror] =
        await admin`select status from billing_subscriptions where contract_id = ${a.contract.id}`;
      expect(mirror.status).toBe("active");
      expect(await audits(a.contract.id)).toEqual([
        expect.objectContaining({ result: "source_unavailable", source: "mirror" }),
      ]);
    });

    it("assinatura de outro identificador na fonte é tratada como fonte indisponível", async () => {
      const { a, b } = await twoOffices();
      retrieve.mockResolvedValue(source(b.checkout, "canceled"));
      const outcome = await reconcileSubscription(MASTER, {
        orgId: "org_a",
        contractId: a.contract.id,
        reason: REASON,
      });
      expect(outcome).toMatchObject({ result: "source_unavailable", source: "mirror" });
      expect(outcome.detail).toContain("provider_subscription_mismatch");
      const [mirror] =
        await admin`select status from billing_subscriptions where contract_id = ${a.contract.id}`;
      expect(mirror.status).toBe("active");
    });

    it("com a fonte disponível usa o estado da fonte, não o do espelho", async () => {
      const { a } = await twoOffices();
      retrieve.mockResolvedValue(source(a.checkout, "past_due"));
      const outcome = await reconcileSubscription(MASTER, {
        orgId: "org_a",
        contractId: a.contract.id,
        reason: REASON,
      });
      expect(retrieve).toHaveBeenCalledWith(providerIds(a.checkout).subscription);
      expect(outcome).toMatchObject({ result: "corrected", source: "provider" });
      const [mirror] =
        await admin`select status from billing_subscriptions where contract_id = ${a.contract.id}`;
      expect(mirror.status).toBe("past_due");
      expect(await rights(a.contract.id)).toEqual([
        expect.objectContaining({ status: "inactive", reason: "payment_past_due" }),
      ]);
    });

    it("licença legada nunca é revogada", async () => {
      await enableByHand(I.companyA, "pgr");
      const { a } = await twoOffices();
      expect(await enabledModules(admin)).toEqual([`${I.companyA}:pgr`]);
      expect(await rights(a.contract.id)).toEqual([
        expect.objectContaining({ status: "active", applied: false }),
      ]);
      await admin`update billing_subscriptions set status = 'canceled' where contract_id = ${a.contract.id}`;

      const outcome = await reconcileSubscription(MASTER, {
        orgId: "org_a",
        contractId: a.contract.id,
        reason: REASON,
      });

      expect(outcome.result).toBe("source_unavailable");
      expect(await rights(a.contract.id)).toEqual([
        expect.objectContaining({ status: "inactive", reason: "subscription_canceled" }),
      ]);
      expect(await enabledModules(admin)).toEqual([`${I.companyA}:pgr`]);
      const touched = await admin`
        select module from company_module_events where org_id = 'org_a' and module = 'pgr'`;
      expect(touched).toHaveLength(0);
    });

    it("contratação inexistente ou de outro escritório é NOT_FOUND e não audita", async () => {
      const { a } = await twoOffices();
      const run = (orgId: string, contractId: string) => () =>
        reconcileSubscription(MASTER, { orgId, contractId, reason: REASON });
      expect(await errorCode(run("org_a", UNKNOWN_ID))).toBe("NOT_FOUND");
      expect(await errorCode(run("org_b", a.contract.id))).toBe("NOT_FOUND");
      expect(await audits(a.contract.id)).toEqual([]);
      expect(retrieve).not.toHaveBeenCalled();
    });

    it("motivo curto é VALIDATION e não audita nem consulta a fonte", async () => {
      const { a } = await twoOffices();
      const reconcileWith = (reason: string) => () =>
        reconcileSubscription(MASTER, {
          orgId: "org_a",
          contractId: a.contract.id,
          reason,
        });
      expect(await errorCode(reconcileWith("curto"))).toBe("VALIDATION");
      expect(await errorCode(reconcileWith("          x          "))).toBe("VALIDATION");
      expect(await audits(a.contract.id)).toEqual([]);
      expect(retrieve).not.toHaveBeenCalled();
    });

    it("não cria cobrança, checkout nem fatura e não chama escrita do provedor", async () => {
      const { a } = await twoOffices();
      retrieve.mockResolvedValue(source(a.checkout, "active"));
      const before = await billingRows();
      const checkoutCalls = provider.mock.calls.length;
      await reconcileSubscription(MASTER, {
        orgId: "org_a",
        contractId: a.contract.id,
        reason: REASON,
      });
      expect(await billingRows()).toEqual(before);
      expect(provider.mock.calls).toHaveLength(checkoutCalls);
    });

    it("a auditoria é append-only para o papel da aplicação", async () => {
      const { a } = await twoOffices();
      await reconcileSubscription(MASTER, {
        orgId: "org_a",
        contractId: a.contract.id,
        reason: REASON,
      });
      await expect(
        asRuntime("org_a", "update commercial_reconciliations set detail = 'x'"),
      ).rejects.toThrow();
      await expect(
        asRuntime("org_a", "delete from commercial_reconciliations"),
      ).rejects.toThrow();
      expect(await audits(a.contract.id)).toHaveLength(1);
    });

    it("o escritório vê só a própria auditoria", async () => {
      const { a } = await twoOffices();
      await reconcileSubscription(MASTER, {
        orgId: "org_a",
        contractId: a.contract.id,
        reason: REASON,
      });
      expect(
        await asRuntime("org_b", "select id from commercial_reconciliations"),
      ).toHaveLength(0);
    });
  });

  describe("Server Actions e REST", () => {
    it("a action lista e reconcilia com o superadmin e bloqueia quem não é", async () => {
      const { a } = await twoOffices();
      const listed = await listAdminSubscriptionsAction({ orgId: "org_a" });
      expect(listed.ok && listed.data.total).toBe(1);
      const detail = await getAdminSubscriptionAction("org_a", a.contract.id);
      expect(detail.ok && detail.data.contractId).toBe(a.contract.id);
      const done = await reconcileSubscriptionAction({
        orgId: "org_a",
        contractId: a.contract.id,
        reason: REASON,
      });
      expect(done.ok && done.data.result).toBe("source_unavailable");

      mockMaster.mockRejectedValue(new ForbiddenError());
      const blocked = await listAdminSubscriptionsAction({});
      expect(blocked).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    });

    it("a action recusa quando o banco não reconhece o usuário como superadmin", async () => {
      await twoOffices();
      mockMaster.mockResolvedValue({ userId: owner.userId });
      expect(await listAdminSubscriptionsAction({})).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN" },
      });
    });

    it("GET lista, GET ficha e POST reconcilia como superadmin", async () => {
      const { a } = await twoOffices();
      const list = await listRoute.GET(devRequest(`${BASE_URL}?service=pgr`, "GET"));
      expect(list.status).toBe(200);
      expect(await list.json()).toMatchObject({ total: 1, rows: [{ orgId: "org_a" }] });

      const detail = await detailRoute.GET(
        devRequest(`${BASE_URL}/${a.contract.id}?orgId=org_a`, "GET"),
        contractParams(a.contract.id),
      );
      expect(detail.status).toBe(200);
      expect(await detail.json()).toMatchObject({ contractId: a.contract.id });

      await forceDivergence(a.contract.id);
      retrieve.mockResolvedValue(source(a.checkout, "active"));
      const reconcile = await reconcileRoute.POST(
        devRequest(`${BASE_URL}/${a.contract.id}/reconcile`, "POST", {
          orgId: "org_a",
          reason: REASON,
        }),
        contractParams(a.contract.id),
      );
      expect(reconcile.status).toBe(200);
      expect(await reconcile.json()).toMatchObject({ result: "corrected" });
      expect(await enabledModules(admin)).toEqual([`${I.companyA}:pgr`]);
    });

    it("POST com motivo curto é 422 e ficha de outro escritório é 404", async () => {
      const { a } = await twoOffices();
      const short = await reconcileRoute.POST(
        devRequest(`${BASE_URL}/${a.contract.id}/reconcile`, "POST", {
          orgId: "org_a",
          reason: "curto",
        }),
        contractParams(a.contract.id),
      );
      expect(short.status).toBe(422);
      const foreign = await detailRoute.GET(
        devRequest(`${BASE_URL}/${a.contract.id}?orgId=org_b`, "GET"),
        contractParams(a.contract.id),
      );
      expect(foreign.status).toBe(404);
    });

    it("o dev bypass não vira superadmin: sem sessão é 401 e owner é 403, nunca 200", async () => {
      const { a } = await twoOffices();
      mockMaster.mockRejectedValue(new UnauthorizedError());
      const anonymous = await listRoute.GET(
        devRequest(BASE_URL, "GET", undefined, "owner"),
      );
      expect(anonymous.status).toBe(401);

      mockMaster.mockRejectedValue(new ForbiddenError());
      const asOwner = await detailRoute.GET(
        devRequest(`${BASE_URL}/${a.contract.id}?orgId=org_a`, "GET", undefined, "owner"),
        contractParams(a.contract.id),
      );
      expect(asOwner.status).toBe(403);
      const reconcile = await reconcileRoute.POST(
        devRequest(`${BASE_URL}/${a.contract.id}/reconcile`, "POST", {
          orgId: "org_a",
          reason: REASON,
        }),
        contractParams(a.contract.id),
      );
      expect(reconcile.status).toBe(403);
      expect(await audits(a.contract.id)).toEqual([]);
    });

    it("mesmo que a sessão aponte para um owner, o banco recusa quem não é is_master", async () => {
      await twoOffices();
      mockMaster.mockResolvedValue({ userId: owner.userId });
      const response = await listRoute.GET(devRequest(BASE_URL, "GET"));
      expect(response.status).toBe(403);
    });
  });
});
