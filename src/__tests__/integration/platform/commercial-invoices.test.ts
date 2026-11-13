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
  clientUser,
  collaborator,
  contractOffer,
  devRequest,
  enabledModules,
  errorCode,
  invoiceEvent,
  outsider,
  owner,
  priceId,
  providerIds,
  routeParams,
  seedCommercialBase,
  subscriptionEvent,
  type CheckoutRef,
  type InvoiceLineSeed,
  type OfferKey,
} from "../_helpers/commercial-seed";
import * as orgs from "@/shared/db/repositories/orgs";
import {
  constructWebhookEvent,
  createCommercialCheckoutSession,
  type CommercialCheckoutRequest,
} from "@/shared/integrations/stripe/client";
import {
  getCommercialInvoiceAction,
  listCommercialInvoicesAction,
} from "@/shared/server/actions/commercial/commercial";
import { getInvoice, listInvoices } from "@/shared/server/commercial/invoices-core";
import { startContractCheckout } from "@/shared/server/commercial/checkout-core";
import * as invoicesRoute from "@/app/api/v1/commercial-invoices/route";
import * as invoiceRoute from "@/app/api/v1/commercial-invoices/[id]/route";
import * as webhook from "@/app/api/webhooks/stripe/route";

const enabled = !!process.env.INTEGRATION_APP_RUNTIME_URL;
const provider = jest.mocked(createCommercialCheckoutSession);
const construct = jest.mocked(constructWebhookEvent);
const legacyPlan = jest.mocked(orgs.updateOrgBilling);
const NO_VALUE = { pgr: 0, medicine: 0, pro: 0, one_off: 0, unclassified: 0 };

(enabled ? describe : describe.skip)("faturas com PGR e Medicina separados", () => {
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
  const subscribe = async (key: OfferKey, companyIds?: string[]) => {
    keys += 1;
    const contract = await contractOffer(catalog, key, companyIds);
    const session = await acting(owner, (ctx) =>
      startContractCheckout(ctx, contract.id, {
        idempotencyKey: `invoice-events-key-${String(keys).padStart(4, "0")}`,
      }),
    );
    const checkout: CheckoutRef = {
      id: session.id,
      providerSessionId: `cs_test_${session.id}`,
    };
    return { contract, checkout };
  };
  const activate = async (checkout: CheckoutRef) => {
    expect(await deliver(checkoutCompletedEvent(checkout))).toBe(200);
    expect(await deliver(subscriptionEvent(checkout, "active"))).toBe(200);
  };
  const stored = () =>
    admin<{ status: string; total_cents: number; items: number }[]>`
      select i.status, i.total_cents,
        (select count(*)::int from billing_invoice_items t where t.invoice_id = i.id) items
      from billing_invoices i order by i.provider_invoice_id`;
  const outcomes = async (type: string) => {
    const rows = await admin<{ outcome: string }[]>`
      select outcome from billing_events where type = ${type} order by occurred_at`;
    return rows.map((row) => row.outcome);
  };
  const onlyInvoice = async (contractId: string) => {
    const page = await acting(owner, (ctx) => listInvoices(ctx, { contractId }));
    expect(page.total).toBe(1);
    return acting(owner, (ctx) => getInvoice(ctx, page.rows[0].id));
  };

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

  describe("valores por serviço", () => {
    const single: [OfferKey, "pgr" | "medicine" | "pro", number][] = [
      ["pgr", "pgr", 11100],
      ["medicine", "medicine", 22200],
      ["pro", "pro", 33300],
    ];
    it.each(single)(
      "fatura da contratação só de %s tem valor apenas desse serviço",
      async (key, service, amount) => {
        const { contract, checkout } = await subscribe(key);
        await activate(checkout);
        const lines: InvoiceLineSeed[] = [{ price: priceId(key, 1), amount }];
        expect(await deliver(invoiceEvent(checkout, "invoice.paid", { lines }))).toBe(
          200,
        );

        const invoice = await onlyInvoice(contract.id);
        expect(invoice).toMatchObject({
          contractId: contract.id,
          status: "paid",
          currency: "BRL",
          totalCents: amount,
          totalsByService: { ...NO_VALUE, [service]: amount },
          items: [{ position: 1, service, quantity: 1, amountCents: amount }],
        });
        expect(invoice.paidAt).toEqual(new Date((T0 + 60) * 1000));
        expect(legacyPlan).not.toHaveBeenCalled();
      },
    );

    it("contratação de PGR e Medicina para duas empresas traz os dois valores separados na mesma fatura", async () => {
      const { contract, checkout } = await subscribe("both", [I.companyA, OTHER_COMPANY]);
      await activate(checkout);
      await deliver(
        invoiceEvent(checkout, "invoice.paid", {
          lines: [
            { price: priceId("both", 2), amount: 44400, quantity: 2 },
            { price: priceId("both", 1), amount: 22200, quantity: 2 },
          ],
        }),
      );
      const invoice = await onlyInvoice(contract.id);
      expect(invoice.totalCents).toBe(66600);
      expect(invoice.totalsByService).toEqual({
        ...NO_VALUE,
        pgr: 22200,
        medicine: 44400,
      });
      expect(invoice.items).toMatchObject([
        { position: 1, service: "medicine", quantity: 2, amountCents: 44400 },
        { position: 2, service: "pgr", quantity: 2, amountCents: 22200 },
      ]);
      const page = await acting(owner, (ctx) => listInvoices(ctx, {}));
      expect(page.rows).toMatchObject([
        { id: invoice.id, totalsByService: { pgr: 22200, medicine: 44400 } },
      ]);
    });

    it("linha de preço desconhecido e diferença para o total ficam não classificadas, nunca em PGR ou Medicina", async () => {
      const { contract, checkout } = await subscribe("pgr");
      await deliver(
        invoiceEvent(checkout, "invoice.finalized", {
          status: "open",
          total: 12000,
          lines: [
            { price: priceId("pgr", 1), amount: 11100 },
            { price: "price_unknown", amount: 500 },
            { price: null, amount: -100 },
          ],
        }),
      );
      const invoice = await onlyInvoice(contract.id);
      expect(invoice.status).toBe("open");
      expect(invoice.totalsByService).toEqual({
        ...NO_VALUE,
        pgr: 11100,
        unclassified: 900,
      });
      expect(invoice.items.map((item) => item.amountCents)).toEqual([
        11100, 500, -100, 500,
      ]);
    });

    it("fatura só com linhas sem preço é registrada inteira como não classificada", async () => {
      const { contract, checkout } = await subscribe("medicine");
      await deliver(
        invoiceEvent(checkout, "invoice.paid", { lines: [{ price: null, amount: 900 }] }),
      );
      expect((await onlyInvoice(contract.id)).totalsByService).toEqual({
        ...NO_VALUE,
        unclassified: 900,
      });

      await deliver(invoiceEvent(checkout, "invoice.paid", { id: "in_zero", lines: [] }));
      expect(await stored()).toContainEqual({ status: "paid", total_cents: 0, items: 0 });
    });
  });

  describe("eventos repetidos e fora de ordem", () => {
    const lines: InvoiceLineSeed[] = [{ price: priceId("pgr", 1), amount: 11100 }];

    it("o mesmo evento entregue duas vezes e a mesma fatura em dois eventos não duplicam fatura nem itens", async () => {
      const { checkout } = await subscribe("pgr");
      const finalized = invoiceEvent(checkout, "invoice.finalized", {
        status: "open",
        lines,
      });
      expect(await deliver(finalized)).toBe(200);
      expect(await deliver(finalized)).toBe(200);
      expect(await stored()).toEqual([{ status: "open", total_cents: 11100, items: 1 }]);

      await deliver(invoiceEvent(checkout, "invoice.paid", { lines }));
      expect(await stored()).toEqual([{ status: "paid", total_cents: 11100, items: 1 }]);
      expect(await outcomes("invoice.finalized")).toEqual(["applied"]);
    });

    it("fatura paga não volta a aberta quando o evento antigo chega depois", async () => {
      const { checkout } = await subscribe("pgr");
      await deliver(
        invoiceEvent(checkout, "invoice.paid", { lines }, { created: T0 + 500 }),
      );
      await deliver(
        invoiceEvent(
          checkout,
          "invoice.payment_failed",
          { status: "open", lines },
          { created: T0 + 400 },
        ),
      );
      await deliver(
        invoiceEvent(
          checkout,
          "invoice.finalized",
          { status: "open", lines },
          { created: T0 + 500 },
        ),
      );
      expect(await stored()).toEqual([{ status: "paid", total_cents: 11100, items: 1 }]);
      expect(await outcomes("invoice.payment_failed")).toEqual(["stale"]);
      expect(await outcomes("invoice.finalized")).toEqual(["stale"]);
    });

    it("falha de pagamento mantém a fatura aberta e a fatura sozinha não liga nem desliga licença", async () => {
      const { checkout } = await subscribe("pgr");
      await deliver(invoiceEvent(checkout, "invoice.paid", { lines }));
      expect(await enabledModules(admin)).toEqual([]);

      await activate(checkout);
      await deliver(
        invoiceEvent(checkout, "invoice.payment_failed", {
          id: "in_second",
          status: "open",
          lines,
        }),
      );
      expect(await stored()).toEqual([
        { status: "paid", total_cents: 11100, items: 1 },
        { status: "open", total_cents: 11100, items: 1 },
      ]);
      expect(await enabledModules(admin)).toEqual([`${I.companyA}:pgr`]);
    });
  });

  describe("isolamento e autorização", () => {
    const lines: InvoiceLineSeed[] = [{ price: priceId("pgr", 1), amount: 11100 }];
    const paidInvoice = async () => {
      const { contract, checkout } = await subscribe("pgr");
      await deliver(invoiceEvent(checkout, "invoice.paid", { lines }));
      return { contract, checkout, invoice: await onlyInvoice(contract.id) };
    };

    it("outro escritório não lista nem abre a fatura, nem direto no banco", async () => {
      const { invoice } = await paidInvoice();
      expect(await acting(outsider, (ctx) => listInvoices(ctx, {}))).toEqual({
        rows: [],
        total: 0,
      });
      expect(
        await errorCode(() => acting(outsider, (ctx) => getInvoice(ctx, invoice.id))),
      ).toBe("NOT_FOUND");
      for (const table of ["billing_invoices", "billing_invoice_items"])
        expect(
          await asRuntime("org_b", "owner_b", `select count(*)::int n from ${table}`),
        ).toEqual([{ n: 0 }]);
    });

    it("colaborador e cliente não consultam fatura; fatura inexistente responde não encontrada", async () => {
      const { invoice } = await paidInvoice();
      for (const member of [collaborator, clientUser]) {
        expect(
          await errorCode(() => acting(member, (ctx) => listInvoices(ctx, {}))),
        ).toBe("FORBIDDEN");
        expect(
          await errorCode(() => acting(member, (ctx) => getInvoice(ctx, invoice.id))),
        ).toBe("FORBIDDEN");
      }
      expect(
        await asRuntime(
          "org_a",
          "collab",
          "select count(*)::int n from billing_invoices",
        ),
      ).toEqual([{ n: 0 }]);
      expect(
        await errorCode(() => acting(owner, (ctx) => getInvoice(ctx, UNKNOWN_ID))),
      ).toBe("NOT_FOUND");
      expect(
        await errorCode(() => acting(owner, (ctx) => getInvoice(ctx, "not-a-uuid"))),
      ).toBe("VALIDATION");
    });

    it("nenhuma sessão de usuário, nem a do administrador, grava ou altera fatura", async () => {
      const { contract, invoice } = await paidInvoice();
      const forged = `insert into billing_invoices (org_id, contract_id, provider, provider_invoice_id, status, currency, total_cents, last_event_at)
        values ('org_a', '${contract.id}', 'stripe', 'in_forged', 'paid', 'BRL', 1, now())`;
      await expect(asRuntime("org_a", "owner", forged)).rejects.toMatchObject({
        code: "42501",
      });
      await expect(
        asRuntime(
          "org_a",
          "owner",
          `update billing_invoices set status = 'void' where id = '${invoice.id}'`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      for (const statement of [
        "delete from billing_invoices",
        "delete from billing_invoice_items",
        "update billing_invoice_items set amount_cents = 0",
        "update billing_invoices set currency = 'USD'",
      ])
        await expect(asRuntime("org_a", null, statement)).rejects.toMatchObject({
          code: "42501",
        });
      expect(await stored()).toEqual([{ status: "paid", total_cents: 11100, items: 1 }]);
    });

    it("fatura de assinatura desconhecida, evento de produção e flag desligada não gravam nada", async () => {
      const { checkout } = await subscribe("pgr");
      const stranger: CheckoutRef = { id: UNKNOWN_ID, providerSessionId: "cs_unknown" };
      expect(await deliver(invoiceEvent(stranger, "invoice.paid", { lines }))).toBe(200);
      expect(
        await deliver(
          invoiceEvent(checkout, "invoice.paid", { lines }, { livemode: true }),
        ),
      ).toBe(200);
      delete process.env.COMMERCIAL_CATALOG_ENABLED;
      expect(await deliver(invoiceEvent(checkout, "invoice.paid", { lines }))).toBe(200);
      expect(await stored()).toEqual([]);
      expect(await admin`select 1 from billing_events`).toEqual([]);
      expect(legacyPlan).not.toHaveBeenCalled();
    });
  });

  describe("consulta", () => {
    it("REST e Server Action listam por contratação com paginação e abrem a fatura sem expor identificador do provedor", async () => {
      const first = await subscribe("pgr");
      for (const id of ["in_a", "in_b", "in_c"])
        await deliver(
          invoiceEvent(first.checkout, "invoice.paid", {
            id,
            lines: [{ price: priceId("pgr", 1), amount: 11100 }],
          }),
        );

      const listed = await invoicesRoute.GET(
        devRequest(
          `/api/v1/commercial-invoices?contractId=${first.contract.id}&page=2&pageSize=2`,
          "GET",
        ),
      );
      expect(listed.status).toBe(200);
      const page = await listed.json();
      expect(page.total).toBe(3);
      expect(page.rows).toHaveLength(1);

      const other = await invoicesRoute.GET(
        devRequest(`/api/v1/commercial-invoices?contractId=${UNKNOWN_ID}`, "GET"),
      );
      expect(await other.json()).toEqual({ rows: [], total: 0 });

      const id: string = page.rows[0].id;
      const opened = await invoiceRoute.GET(
        devRequest(`/api/v1/commercial-invoices/${id}`, "GET"),
        routeParams(id),
      );
      expect(opened.status).toBe(200);
      const body = await opened.json();
      expect(body).toMatchObject({
        id,
        contractId: first.contract.id,
        totalsByService: { pgr: 11100, medicine: 0 },
        items: [{ service: "pgr", amountCents: 11100 }],
      });
      const text = JSON.stringify(body) + JSON.stringify(page);
      expect(text).not.toContain("in_");
      expect(text).not.toContain(priceId("pgr", 1));
      expect(text).not.toContain(providerIds(first.checkout).subscription);

      expect(await listCommercialInvoicesAction({})).toMatchObject({
        ok: true,
        data: { total: 3 },
      });
      expect(await getCommercialInvoiceAction(id)).toMatchObject({
        ok: true,
        data: { totalsByService: { pgr: 11100 } },
      });

      const foreign = await invoiceRoute.GET(
        devRequest(
          `/api/v1/commercial-invoices/${id}`,
          "GET",
          undefined,
          "owner",
          "org_b",
        ),
        routeParams(id),
      );
      expect(foreign.status).toBe(404);
      const asCollaborator = await invoicesRoute.GET(
        devRequest("/api/v1/commercial-invoices", "GET", undefined, "collaborator"),
      );
      expect(asCollaborator.status).toBe(403);
      delete process.env.COMMERCIAL_CATALOG_ENABLED;
      const off = await invoicesRoute.GET(
        devRequest("/api/v1/commercial-invoices", "GET"),
      );
      expect(off.status).toBe(403);
    });
  });
});
