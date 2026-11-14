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
  T0,
  UNKNOWN_ID,
  acting,
  checkoutCompletedEvent,
  collaborator,
  contractFor,
  contractOffer,
  devRequest,
  enabledModules,
  errorCode,
  outsider,
  owner,
  providerEvent,
  providerIds,
  publishOffer,
  routeParams,
  seedCommercialBase,
  subscriptionEvent,
  type CheckoutRef,
  type OfferKey,
} from "../_helpers/commercial-seed";
import * as orgs from "@/shared/db/repositories/orgs";
import {
  constructWebhookEvent,
  createCommercialCheckoutSession,
  type CommercialCheckoutRequest,
} from "@/shared/integrations/stripe/client";
import { getCommercialBillingAction } from "@/shared/server/actions/commercial/commercial";
import { getContractBilling } from "@/shared/server/commercial/billing-events-core";
import { startContractCheckout } from "@/shared/server/commercial/checkout-core";
import * as billingRoute from "@/app/api/v1/commercial-contracts/[id]/billing/route";
import * as webhook from "@/app/api/webhooks/stripe/route";

const enabled = !!process.env.INTEGRATION_APP_RUNTIME_URL;
const provider = jest.mocked(createCommercialCheckoutSession);
const construct = jest.mocked(constructWebhookEvent);
const legacyPlan = jest.mocked(orgs.updateOrgBilling);
const legacyLookup = jest.mocked(orgs.getOrgByStripeCustomerId);
const pgr = (company: string) => `${company}:pgr`;
const medicine = (company: string) => `${company}:medicine`;

(enabled ? describe : describe.skip)("eventos do provedor, assinatura e licenças", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  let catalog: ReturnType<typeof drizzle>;
  let keys = 0;
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
  const openCheckout = async (contractId: string): Promise<CheckoutRef> => {
    keys += 1;
    const session = await acting(owner, (ctx) =>
      startContractCheckout(ctx, contractId, {
        idempotencyKey: `billing-events-key-${String(keys).padStart(4, "0")}`,
      }),
    );
    return { id: session.id, providerSessionId: `cs_test_${session.id}` };
  };
  const subscribe = async (key: OfferKey, companyIds?: string[]) => {
    const contract = await contractOffer(catalog, key, companyIds);
    const checkout = await openCheckout(contract.id);
    return { contract, checkout };
  };
  const activate = async (checkout: CheckoutRef) => {
    expect(await deliver(checkoutCompletedEvent(checkout))).toBe(200);
    expect(await deliver(subscriptionEvent(checkout, "active"))).toBe(200);
  };
  const plan = async (orgId = "org_a") => {
    const [row] = await admin<
      { plan: string }[]
    >`select plan from orgs where id = ${orgId}`;
    return row.plan;
  };
  const entitlements = (contractId: string) =>
    admin<
      {
        company_id: string | null;
        service: string;
        status: string;
        reason: string;
        applied: boolean;
      }[]
    >`select company_id, service, status, reason, applied from commercial_entitlements
      where contract_id = ${contractId} order by company_id nulls first, service`;
  const events = () =>
    admin<{ type: string; outcome: string; detail: string }[]>`
      select type, outcome, detail from billing_events order by received_at, occurred_at`;
  const mirror = async (contractId: string) => {
    const [row] = await admin`
      select status, cancel_at_period_end, extract(epoch from current_period_end)::int as period_end, provider_subscription_id, provider_customer_id
      from billing_subscriptions where contract_id = ${contractId}`;
    return row;
  };
  const enableByHand = (company: string, module: string) =>
    admin`insert into company_modules (org_id, company_id, module, enabled)
          values ('org_a', ${company}, ${module}, true)
          on conflict (org_id, company_id, module) do update set enabled = true`;

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
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    process.env.COMMERCIAL_CATALOG_ENABLED = "true";
  });

  describe("ativação", () => {
    const combinations: [OfferKey, string[], string[], string][] = [
      ["pgr", [I.companyA], [pgr(I.companyA)], "free"],
      ["medicine", [I.companyA], [medicine(I.companyA)], "free"],
      [
        "both",
        [I.companyA, OTHER_COMPANY],
        [
          medicine(I.companyA),
          pgr(I.companyA),
          medicine(OTHER_COMPANY),
          pgr(OTHER_COMPANY),
        ],
        "free",
      ],
      ["pro", [], [], "pro"],
    ];
    it.each(combinations)(
      "contratar %s libera exatamente a combinação contratada",
      async (key, companyIds, modules, expectedPlan) => {
        const { contract, checkout } = await subscribe(key, companyIds);
        expect(await enabledModules(admin)).toEqual([]);
        expect(await plan()).toBe("free");

        expect(await deliver(checkoutCompletedEvent(checkout))).toBe(200);
        expect(await enabledModules(admin)).toEqual([]);
        expect(await plan()).toBe("free");

        expect(await deliver(subscriptionEvent(checkout, "active"))).toBe(200);
        expect(await enabledModules(admin)).toEqual([...modules].sort());
        expect(await plan()).toBe(expectedPlan);
        const rows = await entitlements(contract.id);
        expect(rows).toHaveLength(Math.max(modules.length, 1));
        expect(
          rows.every(
            (row) =>
              row.status === "active" &&
              row.applied &&
              row.reason === "subscription_active",
          ),
        ).toBe(true);
        expect(await mirror(contract.id)).toMatchObject({
          status: "active",
          provider_subscription_id: providerIds(checkout).subscription,
          provider_customer_id: providerIds(checkout).customer,
        });
        expect(legacyPlan).not.toHaveBeenCalled();
        expect(legacyLookup).not.toHaveBeenCalled();
        expect(await plan("org_b")).toBe("pro");
      },
    );

    it("registra o motivo da licença no histórico do serviço e o cliente do provedor do pagador", async () => {
      const { contract, checkout } = await subscribe("pgr");
      await activate(checkout);
      expect(
        await admin`select module, previous_enabled, enabled, changed_by, reason from company_module_events where org_id = 'org_a'`,
      ).toEqual([
        {
          module: "pgr",
          previous_enabled: false,
          enabled: true,
          changed_by: "system:commercial-billing",
          reason: `Direito de uso da contratação ${contract.id}: subscription_active`,
        },
      ]);
      expect(
        await admin`select customer_id, provider_customer_id from billing_provider_customers`,
      ).toEqual([
        {
          customer_id: contract.customerId,
          provider_customer_id: providerIds(checkout).customer,
        },
      ]);
      expect(
        await admin`select status from billing_checkout_sessions where id = ${checkout.id}`,
      ).toEqual([{ status: "completed" }]);
    });

    it("teste gratuito do provedor (trialing) libera como assinatura ativa", async () => {
      const { contract, checkout } = await subscribe("pgr");
      await deliver(subscriptionEvent(checkout, "trialing"));
      expect(await enabledModules(admin)).toEqual([pgr(I.companyA)]);
      expect(await entitlements(contract.id)).toMatchObject([
        { reason: "subscription_trialing", status: "active" },
      ]);
    });

    it("o retorno do checkout sem evento de assinatura não libera nada", async () => {
      const { contract, checkout } = await subscribe("both");
      await deliver(checkoutCompletedEvent(checkout));
      expect(await enabledModules(admin)).toEqual([]);
      expect(await entitlements(contract.id)).toMatchObject([
        { service: "medicine", status: "inactive", reason: "subscription_incomplete" },
        { service: "pgr", status: "inactive", reason: "subscription_incomplete" },
      ]);
      expect(await mirror(contract.id)).toMatchObject({ status: "incomplete" });
    });

    it("checkout expirado fecha a sessão e não cria assinatura", async () => {
      const { contract, checkout } = await subscribe("pgr");
      const status = await deliver(
        providerEvent("checkout.session.expired", {
          id: checkout.providerSessionId,
          metadata: { commercialCheckoutId: checkout.id },
        }),
      );
      expect(status).toBe(200);
      expect(
        await admin`select status from billing_checkout_sessions where id = ${checkout.id}`,
      ).toEqual([{ status: "expired" }]);
      expect(await mirror(contract.id)).toBeUndefined();
      const reopened = await openCheckout(contract.id);
      expect(reopened.id).not.toBe(checkout.id);
    });
  });

  describe("idempotência e ordem", () => {
    it("evento repetido é registrado uma vez e não ativa nem registra de novo", async () => {
      const { checkout } = await subscribe("pgr");
      const completed = checkoutCompletedEvent(checkout);
      const active = subscriptionEvent(checkout, "active");
      for (const event of [completed, active, active, completed, active])
        expect(await deliver(event)).toBe(200);
      expect(await events()).toEqual([
        {
          type: "checkout.session.completed",
          outcome: "applied",
          detail: "checkout_completed",
        },
        {
          type: "customer.subscription.updated",
          outcome: "applied",
          detail: "active",
        },
      ]);
      const [{ total }] =
        await admin`select count(*)::int total from company_module_events where org_id = 'org_a'`;
      expect(total).toBe(1);
      expect(await enabledModules(admin)).toEqual([pgr(I.companyA)]);
    });

    it("o mesmo evento entregue em paralelo é processado uma única vez", async () => {
      const { checkout } = await subscribe("pgr");
      const active = subscriptionEvent(checkout, "active");
      const statuses = await Promise.all([deliver(active), deliver(active)]);
      expect(statuses).toEqual([200, 200]);
      expect(await events()).toHaveLength(1);
      const [{ total }] =
        await admin`select count(*)::int total from company_module_events where org_id = 'org_a'`;
      expect(total).toBe(1);
    });

    it("assinatura que chega antes do retorno do checkout ativa do mesmo jeito", async () => {
      const { contract, checkout } = await subscribe("pgr");
      await deliver(
        subscriptionEvent(checkout, "active", { type: "customer.subscription.created" }),
      );
      expect(await enabledModules(admin)).toEqual([pgr(I.companyA)]);
      await deliver(checkoutCompletedEvent(checkout));
      expect(await enabledModules(admin)).toEqual([pgr(I.companyA)]);
      expect(await mirror(contract.id)).toMatchObject({ status: "active" });
      expect(await entitlements(contract.id)).toHaveLength(1);
    });

    it("evento antigo entregue depois não desfaz o estado mais novo", async () => {
      const { contract, checkout } = await subscribe("pgr");
      await deliver(checkoutCompletedEvent(checkout));
      await deliver(subscriptionEvent(checkout, "active", { created: T0 + 500 }));
      await deliver(subscriptionEvent(checkout, "past_due", { created: T0 + 400 }));
      await deliver(subscriptionEvent(checkout, "incomplete", { created: T0 + 300 }));
      expect(await mirror(contract.id)).toMatchObject({ status: "active" });
      expect(await enabledModules(admin)).toEqual([pgr(I.companyA)]);
      expect((await events()).map((event) => event.outcome)).toEqual([
        "applied",
        "applied",
        "stale",
        "stale",
      ]);
    });

    it("cancelamento não é desfeito por atualização atrasada, nem no mesmo segundo", async () => {
      const { contract, checkout } = await subscribe("pgr");
      await activate(checkout);
      await deliver(subscriptionEvent(checkout, "canceled", { created: T0 + 900 }));
      await deliver(subscriptionEvent(checkout, "active", { created: T0 + 800 }));
      await deliver(subscriptionEvent(checkout, "active", { created: T0 + 900 }));
      await deliver(subscriptionEvent(checkout, "active", { created: T0 + 950 }));
      expect(await mirror(contract.id)).toMatchObject({ status: "canceled" });
      expect(await enabledModules(admin)).toEqual([]);
      expect((await events()).slice(-3)).toEqual([
        {
          type: "customer.subscription.updated",
          outcome: "stale",
          detail: "older_than_last_applied",
        },
        {
          type: "customer.subscription.updated",
          outcome: "stale",
          detail: "transition_not_allowed:canceled->active",
        },
        {
          type: "customer.subscription.updated",
          outcome: "stale",
          detail: "transition_not_allowed:canceled->active",
        },
      ]);
    });
  });

  describe("ciclo da assinatura", () => {
    it("falha e atraso suspendem, recuperação religa, renovação mantém, cancelamento agendado mantém e cancelamento encerra", async () => {
      const { contract, checkout } = await subscribe("both");
      const both = [medicine(I.companyA), pgr(I.companyA)];
      await activate(checkout);
      expect(await enabledModules(admin)).toEqual(both);

      await deliver(subscriptionEvent(checkout, "past_due"));
      expect(await enabledModules(admin)).toEqual([]);
      expect(await entitlements(contract.id)).toMatchObject([
        { status: "inactive", reason: "payment_past_due", applied: false },
        { status: "inactive", reason: "payment_past_due", applied: false },
      ]);

      await deliver(subscriptionEvent(checkout, "active"));
      expect(await enabledModules(admin)).toEqual(both);

      const renewedUntil = T0 + 5_184_000;
      await deliver(
        subscriptionEvent(checkout, "active", {
          object: {
            items: {
              data: [
                {
                  current_period_start: T0 + 2_592_000,
                  current_period_end: renewedUntil,
                },
              ],
            },
          },
        }),
      );
      expect(await enabledModules(admin)).toEqual(both);
      expect(await mirror(contract.id)).toMatchObject({
        status: "active",
        period_end: renewedUntil,
      });

      await deliver(
        subscriptionEvent(checkout, "active", { object: { cancel_at_period_end: true } }),
      );
      expect(await enabledModules(admin)).toEqual(both);
      expect(await mirror(contract.id)).toMatchObject({ cancel_at_period_end: true });

      await deliver(subscriptionEvent(checkout, "unpaid"));
      expect(await enabledModules(admin)).toEqual([]);
      await deliver(subscriptionEvent(checkout, "active"));
      expect(await enabledModules(admin)).toEqual(both);

      await deliver(subscriptionEvent(checkout, "canceled"));
      expect(await enabledModules(admin)).toEqual([]);
      expect(await entitlements(contract.id)).toMatchObject([
        { status: "inactive", reason: "subscription_canceled", applied: false },
        { status: "inactive", reason: "subscription_canceled", applied: false },
      ]);
      const history = await admin<{ enabled: boolean }[]>`
        select enabled from company_module_events
        where org_id = 'org_a' and module = 'pgr' order by changed_at, id`;
      expect(history.filter((row) => row.enabled)).toHaveLength(3);
      expect(history.filter((row) => !row.enabled)).toHaveLength(3);
    });

    it("o Pro contratado liga e desliga o plano do escritório conforme a assinatura", async () => {
      const { checkout } = await subscribe("pro");
      await activate(checkout);
      expect(await plan()).toBe("pro");
      await deliver(subscriptionEvent(checkout, "past_due"));
      expect(await plan()).toBe("free");
      await deliver(subscriptionEvent(checkout, "active"));
      expect(await plan()).toBe("pro");
      await deliver(subscriptionEvent(checkout, "canceled"));
      expect(await plan()).toBe("free");
      expect(await plan("org_b")).toBe("pro");
      expect(legacyPlan).not.toHaveBeenCalled();
    });

    it("serviço desligado à mão pelo administrador durante a assinatura continua desligado na renovação", async () => {
      const { checkout } = await subscribe("pgr");
      await activate(checkout);
      await admin`update company_modules set enabled = false where org_id = 'org_a'`;
      await deliver(subscriptionEvent(checkout, "active"));
      expect(await enabledModules(admin)).toEqual([]);
      await deliver(subscriptionEvent(checkout, "past_due"));
      await deliver(subscriptionEvent(checkout, "active"));
      expect(await enabledModules(admin)).toEqual([pgr(I.companyA)]);
    });

    it("duas contratações do mesmo serviço para a mesma empresa: só o fim da última desliga", async () => {
      const first = await subscribe("pgr");
      const other = await publishOffer(catalog, "both");
      const second = await contractFor(first.contract.customerId, other.id, [I.companyA]);
      const secondCheckout = await openCheckout(second.id);
      await activate(first.checkout);
      await activate(secondCheckout);
      expect(await enabledModules(admin)).toEqual([
        medicine(I.companyA),
        pgr(I.companyA),
      ]);

      await deliver(subscriptionEvent(first.checkout, "canceled"));
      expect(await enabledModules(admin)).toEqual([
        medicine(I.companyA),
        pgr(I.companyA),
      ]);
      await deliver(subscriptionEvent(secondCheckout, "canceled"));
      expect(await enabledModules(admin)).toEqual([]);
    });
  });

  describe("legado e cortesia nunca são revogados", () => {
    const hostile = ["past_due", "unpaid", "paused", "active", "canceled"];

    it("serviço ligado à mão antes da contratação continua ligado depois de qualquer evento", async () => {
      await enableByHand(I.companyA, "pgr");
      await enableByHand(OTHER_COMPANY, "medicine");
      const { contract, checkout } = await subscribe("both", [I.companyA]);
      await activate(checkout);
      expect(await enabledModules(admin)).toEqual([
        medicine(I.companyA),
        pgr(I.companyA),
        medicine(OTHER_COMPANY),
      ]);
      expect(await entitlements(contract.id)).toMatchObject([
        { service: "medicine", status: "active", applied: true },
        { service: "pgr", status: "active", applied: false },
      ]);

      for (const status of hostile) await deliver(subscriptionEvent(checkout, status));
      expect(await mirror(contract.id)).toMatchObject({ status: "canceled" });
      expect(await enabledModules(admin)).toEqual([
        pgr(I.companyA),
        medicine(OTHER_COMPANY),
      ]);
      const touched = await admin`
        select module from company_module_events where org_id = 'org_a' and module = 'pgr'`;
      expect(touched).toHaveLength(0);
    });

    it("Pro legado (plano já pro sem contratação) continua pro depois de qualquer evento", async () => {
      await admin`update orgs set plan = 'pro', stripe_customer_id = 'cus_legacy', stripe_subscription_id = 'sub_legacy' where id = 'org_a'`;
      const { contract, checkout } = await subscribe("pro");
      await activate(checkout);
      expect(await entitlements(contract.id)).toMatchObject([
        { service: "pro", status: "active", applied: false },
      ]);
      for (const status of hostile) await deliver(subscriptionEvent(checkout, status));
      expect(
        await admin`select plan, stripe_customer_id, stripe_subscription_id from orgs where id = 'org_a'`,
      ).toEqual([
        {
          plan: "pro",
          stripe_customer_id: "cus_legacy",
          stripe_subscription_id: "sub_legacy",
        },
      ]);
    });

    it("empresa fora da contratação e outro escritório não mudam", async () => {
      await enableByHand(OTHER_COMPANY, "pgr");
      const before = await enabledModules(admin, "org_b");
      const { checkout } = await subscribe("pgr");
      await activate(checkout);
      await deliver(subscriptionEvent(checkout, "canceled"));
      expect(await enabledModules(admin)).toEqual([pgr(OTHER_COMPANY)]);
      expect(await enabledModules(admin, "org_b")).toEqual(before);
      expect(before.length).toBeGreaterThan(0);
    });

    it("o banco recusa revogar o que a reconciliação não concedeu, mesmo chamando a função direto", async () => {
      await enableByHand(I.companyA, "pgr");
      const { contract, checkout } = await subscribe("pgr");
      await activate(checkout);
      const [{ id }] = await admin<{ id: string }[]>`
        select id from commercial_entitlements where contract_id = ${contract.id}`;
      await admin`update commercial_entitlements set status = 'inactive' where id = ${id}`;
      const outcome = await asRuntime(
        "org_a",
        null,
        `select public.commercial_reconcile_grant('${id}') as outcome`,
      );
      expect(outcome).toEqual([{ outcome: "kept" }]);
      expect(await enabledModules(admin)).toEqual([pgr(I.companyA)]);

      await expect(
        asRuntime("org_a", "owner", `select public.commercial_reconcile_grant('${id}')`),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        asRuntime("org_b", null, `select public.commercial_reconcile_grant('${id}')`),
      ).rejects.toMatchObject({ code: "42501" });
      const direct = await asRuntime(
        "org_a",
        null,
        "update company_modules set enabled = false where org_id = 'org_a'",
      );
      expect(direct.count).toBe(0);
      await expect(
        asRuntime(
          "org_a",
          null,
          `update commercial_entitlements set applied = true where id = '${id}'`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      expect(await enabledModules(admin)).toEqual([pgr(I.companyA)]);
    });
  });

  describe("vínculo e isolamento", () => {
    it("o escritório vem do checkout registrado, nunca do que o evento diz", async () => {
      const { contract, checkout } = await subscribe("pgr");
      await deliver(checkoutCompletedEvent(checkout));
      await deliver(
        subscriptionEvent(checkout, "active", {
          object: {
            metadata: { commercialCheckoutId: checkout.id, orgId: "org_b" },
            org_id: "org_b",
          },
        }),
      );
      expect(await enabledModules(admin)).toEqual([pgr(I.companyA)]);
      expect(
        await admin`select distinct org_id from billing_events union select distinct org_id from commercial_entitlements`,
      ).toEqual([{ org_id: "org_a" }]);
      expect(await mirror(contract.id)).toMatchObject({ status: "active" });
      expect(legacyPlan).not.toHaveBeenCalled();
    });

    it("assinatura já registrada é reconhecida pelo id do provedor mesmo sem a referência no evento", async () => {
      const { contract, checkout } = await subscribe("pgr");
      await activate(checkout);
      await deliver(
        subscriptionEvent(checkout, "canceled", { object: { metadata: {} } }),
      );
      expect(await mirror(contract.id)).toMatchObject({ status: "canceled" });
      expect(await enabledModules(admin)).toEqual([]);
      expect(legacyLookup).not.toHaveBeenCalled();
    });

    it("sessão do provedor diferente da registrada é ignorada e não cria assinatura", async () => {
      const { contract, checkout } = await subscribe("pgr");
      await deliver(
        checkoutCompletedEvent({ id: checkout.id, providerSessionId: "cs_test_forged" }),
      );
      expect(await mirror(contract.id)).toBeUndefined();
      expect(await events()).toEqual([
        {
          type: "checkout.session.completed",
          outcome: "ignored",
          detail: "checkout_session_not_registered",
        },
      ]);
      expect(
        await admin`select status from billing_checkout_sessions where id = ${checkout.id}`,
      ).toEqual([{ status: "open" }]);
    });

    it("segunda assinatura do provedor para a mesma contratação não troca o espelho nem a licença", async () => {
      const { contract, checkout } = await subscribe("pgr");
      await activate(checkout);
      await deliver(
        subscriptionEvent(checkout, "canceled", { object: { id: "sub_other" } }),
      );
      expect(await mirror(contract.id)).toMatchObject({
        status: "active",
        provider_subscription_id: providerIds(checkout).subscription,
      });
      expect(await enabledModules(admin)).toEqual([pgr(I.companyA)]);
      expect((await events()).at(-1)).toMatchObject({
        outcome: "ignored",
        detail: "another_subscription_for_contract",
      });
    });

    it("referência de checkout desconhecida não grava nada no fluxo novo", async () => {
      const ghost = { id: UNKNOWN_ID, providerSessionId: "cs_test_ghost" };
      expect(await deliver(subscriptionEvent(ghost, "active"))).toBe(200);
      const [{ total }] = await admin`
        select (select count(*) from billing_events) + (select count(*) from billing_subscriptions)
             + (select count(*) from commercial_entitlements) as total`;
      expect(Number(total)).toBe(0);
      expect(await enabledModules(admin)).toEqual([]);
    });

    it("outra organização não consulta a cobrança nem enxerga espelho, eventos ou direitos no banco", async () => {
      const { contract, checkout } = await subscribe("pgr");
      await activate(checkout);
      expect(
        await errorCode(() =>
          acting(outsider, (ctx) => getContractBilling(ctx, contract.id)),
        ),
      ).toBe("NOT_FOUND");
      for (const table of [
        "billing_subscriptions",
        "billing_events",
        "commercial_entitlements",
        "billing_provider_customers",
        "billing_checkout_sessions",
      ])
        expect(
          await asRuntime("org_b", "owner_b", `select org_id from ${table}`),
        ).toHaveLength(0);
      const byReference = await runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org','org_b',true), set_config('app.current_actor','owner_b',true), set_config('app.billing_reference',${checkout.id},true)`;
        return tx`select org_id from billing_checkout_sessions`;
      });
      expect(byReference).toHaveLength(0);
    });

    it("sessão de usuário, mesmo do administrador, não forja assinatura, direito, evento nem cliente do provedor", async () => {
      const { contract, checkout } = await subscribe("pgr");
      await activate(checkout);
      const forged = [
        `insert into billing_subscriptions (org_id, contract_id, provider, provider_subscription_id, status)
           values ('org_a', '${contract.id}', 'stripe', 'sub_forged', 'active')`,
        `insert into commercial_entitlements (org_id, contract_id, company_id, service, status, reason)
           values ('org_a', '${contract.id}', '${OTHER_COMPANY}', 'pgr', 'active', 'forged')`,
        `insert into billing_events (org_id, contract_id, provider, provider_event_id, type, occurred_at, outcome, detail)
           values ('org_a', '${contract.id}', 'stripe', 'evt_forged', 'x', now(), 'applied', 'x')`,
        `insert into billing_provider_customers (org_id, customer_id, provider, provider_customer_id)
           values ('org_a', '${contract.customerId}', 'stripe', 'cus_forged')`,
      ];
      for (const statement of forged)
        await expect(asRuntime("org_a", "owner", statement)).rejects.toMatchObject({
          code: "42501",
        });
      await deliver(subscriptionEvent(checkout, "canceled"));
      for (const statement of [
        "update billing_subscriptions set status = 'active'",
        "update commercial_entitlements set status = 'active'",
      ])
        await expect(asRuntime("org_a", "owner", statement)).rejects.toMatchObject({
          code: "42501",
        });
      for (const statement of [
        "update billing_events set outcome = 'ignored'",
        "delete from billing_events",
        "delete from billing_subscriptions",
        "delete from commercial_entitlements",
      ])
        await expect(asRuntime("org_a", null, statement)).rejects.toMatchObject({
          code: "42501",
        });
      expect(await enabledModules(admin)).toEqual([]);
    });
  });

  describe("fluxo antigo preservado", () => {
    const legacyCheckout = providerEvent("checkout.session.completed", {
      id: "cs_legacy",
      metadata: { orgId: "org_a" },
      client_reference_id: "org_a",
      customer: "cus_legacy",
      subscription: "sub_legacy",
    });
    const legacySubscription = providerEvent("customer.subscription.updated", {
      id: "sub_legacy",
      customer: "cus_legacy",
      status: "past_due",
      metadata: { orgId: "org_a" },
      trial_end: null,
    });
    const legacyCalls = [
      [
        "org_a",
        {
          plan: "pro",
          stripeCustomerId: "cus_legacy",
          stripeSubscriptionId: "sub_legacy",
        },
      ],
      [
        "org_a",
        {
          plan: "free",
          stripeCustomerId: "cus_legacy",
          stripeSubscriptionId: "sub_legacy",
          trialEndsAt: null,
        },
      ],
    ];

    it("com a flag ligada, eventos do Pro antigo seguem o caminho antigo e não tocam as tabelas novas", async () => {
      expect(await deliver(legacyCheckout)).toBe(200);
      expect(await deliver(legacySubscription)).toBe(200);
      expect(legacyPlan.mock.calls).toEqual(legacyCalls);
      expect(await events()).toHaveLength(0);
      expect(await enabledModules(admin)).toEqual([]);
    });

    it("com a flag desligada, evento com referência comercial é ignorado e o Pro antigo segue igual", async () => {
      const { contract, checkout } = await subscribe("pgr");
      delete process.env.COMMERCIAL_CATALOG_ENABLED;
      legacyLookup.mockResolvedValue(null);
      expect(await deliver(subscriptionEvent(checkout, "active"))).toBe(200);
      expect(legacyLookup).not.toHaveBeenCalled();
      expect(await deliver(legacyCheckout)).toBe(200);
      expect(await deliver(legacySubscription)).toBe(200);
      expect(legacyPlan.mock.calls).toEqual(legacyCalls);
      expect(await events()).toHaveLength(0);
      expect(await mirror(contract.id)).toBeUndefined();
      expect(await enabledModules(admin)).toEqual([]);
    });

    it("evento de produção (livemode) nunca entra no fluxo comercial", async () => {
      const { contract, checkout } = await subscribe("pgr");
      legacyLookup.mockResolvedValue(null);
      expect(
        await deliver(subscriptionEvent(checkout, "active", { livemode: true })),
      ).toBe(200);
      expect(legacyLookup).not.toHaveBeenCalled();
      expect(legacyPlan).not.toHaveBeenCalled();
      expect(await mirror(contract.id)).toBeUndefined();
      expect(await enabledModules(admin)).toEqual([]);
    });
  });

  describe("consulta", () => {
    it("o administrador consulta assinatura, direitos de uso e política de atraso; colaborador e flag desligada são barrados", async () => {
      const { contract, checkout } = await subscribe("both");
      const empty = await acting(owner, (ctx) => getContractBilling(ctx, contract.id));
      expect(empty).toMatchObject({
        contractId: contract.id,
        checkout: { id: checkout.id, status: "open" },
        subscription: null,
        entitlements: [],
        delinquencyPolicy: { graceDays: 0 },
      });
      await activate(checkout);

      const response = await billingRoute.GET(
        devRequest(`/api/v1/commercial-contracts/${contract.id}/billing`, "GET"),
        routeParams(contract.id),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        contractId: contract.id,
        checkout: { status: "completed" },
        subscription: { status: "active", cancelAtPeriodEnd: false },
        entitlements: [
          {
            companyId: I.companyA,
            service: "medicine",
            status: "active",
            reason: "subscription_active",
            applied: true,
          },
          { companyId: I.companyA, service: "pgr", status: "active", applied: true },
        ],
      });
      expect(JSON.stringify(body)).not.toContain(providerIds(checkout).subscription);
      expect(JSON.stringify(body)).not.toContain(providerIds(checkout).customer);

      expect(await getCommercialBillingAction(contract.id)).toMatchObject({
        ok: true,
        data: { subscription: { status: "active" } },
      });
      expect(
        await errorCode(() =>
          acting(collaborator, (ctx) => getContractBilling(ctx, contract.id)),
        ),
      ).toBe("FORBIDDEN");
      expect(
        await errorCode(() =>
          acting(owner, (ctx) => getContractBilling(ctx, UNKNOWN_ID)),
        ),
      ).toBe("NOT_FOUND");
      const foreign = await billingRoute.GET(
        devRequest(
          `/api/v1/commercial-contracts/${contract.id}/billing`,
          "GET",
          undefined,
          "owner",
          "org_b",
        ),
        routeParams(contract.id),
      );
      expect(foreign.status).toBe(404);
      delete process.env.COMMERCIAL_CATALOG_ENABLED;
      const off = await billingRoute.GET(
        devRequest(`/api/v1/commercial-contracts/${contract.id}/billing`, "GET"),
        routeParams(contract.id),
      );
      expect(off.status).toBe(403);
    });
  });
});
