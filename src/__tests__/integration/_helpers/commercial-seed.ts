import type postgres from "postgres";
import type { drizzle } from "drizzle-orm/postgres-js";
import { NextRequest } from "next/server";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  createOfferVersion,
  mapProviderPrice,
  publishOfferVersion,
} from "@/shared/db/repositories/commercial-catalog-admin";
import { runAsActor } from "@/shared/db/session-actor";
import type { OfferItem, OfferVersionInput } from "@/shared/domains/commercial/offer";
import { toActionError } from "@/shared/server/action-error";
import * as core from "@/shared/server/commercial/commercial-core";

import { seedPgrBase, PGR_IDS as I } from "./pgr-seed";

type Sql = ReturnType<typeof postgres>;
type Catalog = ReturnType<typeof drizzle>;

export const OTHER_COMPANY = "11111111-1111-1111-1111-1111111111c9";
export const UNKNOWN_ID = "99999999-9999-4999-8999-999999999999";

const member = (tenantId: string, userId: string, role: string): TenantContext => ({
  tenantId,
  userId,
  role,
  plan: "free",
});
export const owner = member("org_a", "owner", "owner");
export const collaborator = member("org_a", "collab", "collaborator");
export const clientUser = member("org_a", "client_user", "client");
export const outsider = member("org_b", "owner_b", "owner");

export const acting = <T>(ctx: TenantContext, run: (ctx: TenantContext) => Promise<T>) =>
  runAsActor(ctx.userId, () => run(ctx));
export const errorCode = (run: () => Promise<unknown>) =>
  run().then(
    () => "resolved",
    (error: unknown) => toActionError(error)?.code ?? String(error),
  );
export const routeParams = (id: string) => ({ params: Promise.resolve({ id }) });
export const devRequest = (
  url: string,
  method: "GET" | "POST",
  body?: unknown,
  role = "owner",
  tenant = "org_a",
) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": tenant,
      "x-dev-user": tenant === "org_a" ? "owner" : "owner_b",
      "x-dev-role": role,
    },
  });

const offer = (
  code: string,
  scope: OfferVersionInput["scope"],
  items: OfferVersionInput["items"],
  period: OfferVersionInput["billingPeriod"] = "monthly",
): OfferVersionInput => ({
  code: `ficticio-${code}`,
  name: `${code} (catálogo fictício de teste)`,
  description: "Oferta fictícia.",
  scope,
  currency: "BRL",
  billingPeriod: period,
  items,
  quotas: [],
  validFrom: "2026-01-01",
  validUntil: null,
  fictitious: true,
  approvalReference: null,
});
const pgrItem: OfferItem = {
  service: "pgr",
  label: "PGR por empresa",
  unit: "company",
  unitAmountCents: 11100,
};
const medicineItem: OfferItem = {
  service: "medicine",
  label: "Medicina por empresa",
  unit: "company",
  unitAmountCents: 22200,
};
export const OFFERS = {
  pgr: offer("pgr", "company", [pgrItem]),
  medicine: offer("medicina", "company", [medicineItem]),
  both: offer("pgr-medicina", "company", [pgrItem, medicineItem]),
  oneOff: offer(
    "avulso-laudo",
    "company",
    [
      {
        service: "one_off",
        label: "Laudo avulso por pedido",
        unit: "company",
        unitAmountCents: 44400,
      },
    ],
    "one_time",
  ),
  pro: offer("pro", "organization", [
    {
      service: "pro",
      label: "Pro por escritório",
      unit: "organization",
      unitAmountCents: 33300,
    },
  ]),
};
export type OfferKey = keyof typeof OFFERS;
export const priceId = (key: OfferKey, position: number) => `price_test${key}${position}`;

export async function seedCommercialBase(admin: Sql): Promise<void> {
  await seedPgrBase(admin);
  await admin.unsafe(`
    truncate table commercial_offer_versions cascade;
    insert into users (id,email) values
      ('owner','owner@example.test'), ('collab','collab@example.test'),
      ('client_user','client@example.test'), ('owner_b','owner-b@example.test');
    insert into org_memberships (org_id,user_id,role) values
      ('org_a','owner','owner'), ('org_a','collab','collaborator'),
      ('org_a','client_user','client'), ('org_b','owner_b','owner');
    insert into companies (id,org_id,cnpj,razao_social) values
      ('${OTHER_COMPANY}','org_a','11444777000161','Outra Ltda');
    delete from company_modules where org_id = 'org_a';
  `);
}

export async function publishOffer(
  catalog: Catalog,
  key: OfferKey,
  options: { mapped: boolean } = { mapped: true },
) {
  const created = await createOfferVersion(catalog, OFFERS[key], "operador");
  await publishOfferVersion(catalog, created.id, "operador");
  const positions = options.mapped ? OFFERS[key].items.map((_, index) => index + 1) : [];
  for (const position of positions)
    await mapProviderPrice(
      catalog,
      {
        offerVersionId: created.id,
        position,
        providerPriceId: priceId(key, position),
      },
      "operador",
    );
  return created;
}

export const registerOffice = (ctx = owner) =>
  acting(ctx, (actor) =>
    core.registerCustomer(actor, {
      kind: "office",
      legalName: ctx.tenantId === "org_a" ? "Consultoria A Ltda" : "Consultoria B Ltda",
      taxId: "11.444.777/0001-61",
      billingEmail: "financeiro@consultoria.test",
    }),
  );

export const contractFor = (
  customerId: string,
  offerVersionId: string,
  companyIds: string[],
  ctx = owner,
) =>
  acting(ctx, (actor) =>
    core.registerContract(actor, {
      customerId,
      offerVersionId,
      companyIds,
      termStart: "2026-11-13",
      termEnd: null,
    }),
  );

export async function contractOffer(
  catalog: Catalog,
  key: OfferKey,
  companyIds: string[] = key === "pro" ? [] : [I.companyA],
) {
  const published = await publishOffer(catalog, key);
  const office = await registerOffice();
  return contractFor(office.id, published.id, companyIds);
}

export const licenses = (admin: Sql) =>
  admin`select o.id, o.plan, o.stripe_customer_id, o.stripe_subscription_id, o.trial_ends_at,
      (select coalesce(jsonb_agg(jsonb_build_array(m.company_id, m.module, m.enabled) order by m.company_id, m.module), '[]'::jsonb)
         from company_modules m where m.org_id = o.id) modules
    from orgs o order by o.id`;

export const enabledModules = async (admin: Sql, orgId = "org_a") => {
  const rows = await admin<{ company_id: string; module: string }[]>`
    select company_id, module from company_modules
    where org_id = ${orgId} and enabled order by company_id, module`;
  return rows.map((row) => `${row.company_id}:${row.module}`);
};

let eventSequence = 0;
export const T0 = 1_800_000_000;

export function providerEvent(
  type: string,
  object: Record<string, unknown>,
  overrides: { id?: string; created?: number; livemode?: boolean } = {},
) {
  eventSequence += 1;
  return {
    id: overrides.id ?? `evt_test_${eventSequence}`,
    type,
    created: overrides.created ?? T0 + eventSequence,
    livemode: overrides.livemode ?? false,
    data: { object },
  };
}

export type CheckoutRef = { id: string; providerSessionId: string };

export const providerIds = (checkout: CheckoutRef) => ({
  subscription: `sub_${checkout.id.slice(0, 8)}`,
  customer: `cus_${checkout.id.slice(0, 8)}`,
});

export const checkoutCompletedEvent = (
  checkout: CheckoutRef,
  overrides: Parameters<typeof providerEvent>[2] = {},
) =>
  providerEvent(
    "checkout.session.completed",
    {
      id: checkout.providerSessionId,
      metadata: { commercialCheckoutId: checkout.id },
      client_reference_id: checkout.id,
      customer: providerIds(checkout).customer,
      subscription: providerIds(checkout).subscription,
    },
    overrides,
  );

export const subscriptionEvent = (
  checkout: CheckoutRef,
  status: string,
  overrides: Parameters<typeof providerEvent>[2] & {
    type?: string;
    object?: Record<string, unknown>;
  } = {},
) =>
  providerEvent(
    overrides.type ??
      (status === "canceled"
        ? "customer.subscription.deleted"
        : "customer.subscription.updated"),
    {
      id: providerIds(checkout).subscription,
      customer: providerIds(checkout).customer,
      status,
      metadata: { commercialCheckoutId: checkout.id },
      cancel_at_period_end: false,
      canceled_at: null,
      trial_end: null,
      items: { data: [{ current_period_start: T0, current_period_end: T0 + 2_592_000 }] },
      ...overrides.object,
    },
    overrides,
  );

export type InvoiceLineSeed = { price: string | null; amount: number; quantity?: number };

export const invoiceEvent = (
  checkout: CheckoutRef,
  type: string,
  invoice: {
    id?: string;
    status?: string;
    total?: number;
    lines: InvoiceLineSeed[];
    object?: Record<string, unknown>;
  },
  overrides: Parameters<typeof providerEvent>[2] = {},
) =>
  providerEvent(
    type,
    {
      id: invoice.id ?? `in_${checkout.id.slice(0, 8)}`,
      status: invoice.status ?? "paid",
      currency: "brl",
      total: invoice.total ?? invoice.lines.reduce((sum, line) => sum + line.amount, 0),
      due_date: null,
      period_start: T0,
      period_end: T0 + 2_592_000,
      status_transitions: { finalized_at: T0, paid_at: T0 + 60 },
      parent: {
        subscription_details: {
          subscription: providerIds(checkout).subscription,
          metadata: { commercialCheckoutId: checkout.id },
        },
      },
      lines: {
        data: invoice.lines.map((line) => ({
          description: line.price ? "Linha do provedor" : "Ajuste",
          amount: line.amount,
          quantity: line.quantity ?? 1,
          pricing: { price_details: { price: line.price } },
        })),
      },
      ...invoice.object,
    },
    overrides,
  );
