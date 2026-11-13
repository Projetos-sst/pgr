import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { NextRequest } from "next/server";

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
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  createOfferVersion,
  deactivateOfferVersion,
  listOfferVersions,
  publishOfferVersion,
  runCatalogCommand,
  seedFictitiousCatalog,
} from "@/shared/db/repositories/commercial-catalog-admin";
import { runAsActor } from "@/shared/db/session-actor";
import { CommercialCatalogError } from "@/shared/domains/commercial/catalog-admin";
import { FICTITIOUS_CATALOG } from "@/shared/domains/commercial/fictitious-catalog";
import type { OfferVersionInput } from "@/shared/domains/commercial/offer";
import { toActionError } from "@/shared/server/action-error";
import * as core from "@/shared/server/commercial/commercial-core";
import {
  listCommercialOffersAction,
  registerCommercialContractAction,
  registerCommercialCustomerAction,
} from "@/shared/server/actions/commercial/commercial";
import * as offersRoute from "@/app/api/v1/commercial-offers/route";
import * as customersRoute from "@/app/api/v1/commercial-customers/route";
import * as customerRoute from "@/app/api/v1/commercial-customers/[id]/route";
import * as contractsRoute from "@/app/api/v1/commercial-contracts/route";
import * as contractRoute from "@/app/api/v1/commercial-contracts/[id]/route";

const enabled = !!process.env.INTEGRATION_APP_RUNTIME_URL;
const OTHER_COMPANY = "11111111-1111-1111-1111-1111111111c9";
const UNKNOWN = "99999999-9999-4999-8999-999999999999";
const member = (tenantId: string, userId: string, role: string): TenantContext => ({
  tenantId,
  userId,
  role,
  plan: "free",
});
const owner = member("org_a", "owner", "owner");
const collaborator = member("org_a", "collab", "collaborator");
const client = member("org_a", "client_user", "client");
const outsider = member("org_b", "owner_b", "owner");
const acting = <T>(ctx: TenantContext, run: (ctx: TenantContext) => Promise<T>) =>
  runAsActor(ctx.userId, () => run(ctx));
const code = (run: () => Promise<unknown>) =>
  run().then(
    () => "resolved",
    (error: unknown) =>
      error instanceof CommercialCatalogError ? error.reason : toActionError(error)?.code,
  );
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (
  url: string,
  method: "GET" | "POST" | "PUT",
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

const pgrOffer = (unitAmountCents: number): OfferVersionInput => ({
  code: "ficticio-pgr",
  name: "PGR (catálogo fictício de teste)",
  description: "Oferta fictícia.",
  scope: "company",
  currency: "BRL",
  billingPeriod: "monthly",
  items: [
    { service: "pgr", label: "PGR por empresa", unit: "company", unitAmountCents },
    { service: "one_off", label: "Implantação", unit: "document", unitAmountCents: 500 },
  ],
  quotas: [{ metric: "employees", limit: 50 }],
  validFrom: "2026-01-01",
  validUntil: null,
  fictitious: true,
  approvalReference: null,
});
const proOffer: OfferVersionInput = {
  ...pgrOffer(0),
  code: "ficticio-pro",
  name: "Pro (catálogo fictício de teste)",
  scope: "organization",
  items: [
    {
      service: "pro",
      label: "Pro por escritório",
      unit: "organization",
      unitAmountCents: 33333,
    },
  ],
  quotas: [],
};
const approvedOffer: OfferVersionInput = {
  ...pgrOffer(77777),
  code: "pgr",
  name: "PGR aprovado em teste",
  fictitious: false,
  approvalReference: "Ata de teste",
};
const officeCustomer = {
  kind: "office",
  legalName: "Consultoria A Ltda",
  taxId: "11.444.777/0001-61",
  billingEmail: "financeiro@consultoria.test",
};
const directCustomer = {
  kind: "company",
  companyId: I.companyA,
  billingEmail: "financeiro@empresa-a.test",
};

(enabled ? describe : describe.skip)("clientes e catálogo comercial versionado", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  let catalog: ReturnType<typeof drizzle>;
  const oldEnv = { ...process.env };

  const asRuntime = (orgId: string, userId: string, statement: string) =>
    runtime.begin(async (tx) => {
      await tx`select set_config('app.current_org',${orgId},true), set_config('app.current_actor',${userId},true)`;
      return tx.unsafe(statement);
    });
  const publish = async (input: OfferVersionInput) => {
    const created = await createOfferVersion(catalog, input, "operador");
    await publishOfferVersion(catalog, created.id, "operador");
    return created;
  };
  const register = (input: unknown, ctx = owner) =>
    acting(ctx, (actor) => core.registerCustomer(actor, input));
  const contract = (input: Record<string, unknown>, ctx = owner) =>
    acting(ctx, (actor) =>
      core.registerContract(actor, { termStart: "2026-11-13", termEnd: null, ...input }),
    );
  const licenses = () =>
    admin`select o.id, o.plan, o.stripe_customer_id, o.stripe_subscription_id, o.trial_ends_at,
        (select coalesce(jsonb_agg(jsonb_build_array(m.company_id, m.module, m.enabled) order by m.company_id, m.module), '[]'::jsonb)
           from company_modules m where m.org_id = o.id) modules
      from orgs o order by o.id`;

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
    `);
    mockStaff.mockReset();
    mockStaff.mockResolvedValue(owner);
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    process.env.COMMERCIAL_CATALOG_ENABLED = "true";
  });

  describe("catálogo da plataforma", () => {
    it("rascunho não aparece para o runtime; publicado aparece com itens, preço, moeda, unidade, periodicidade, cotas e vigência", async () => {
      const draft = await createOfferVersion(catalog, pgrOffer(11111), "operador");
      expect(draft.version).toBe(1);
      expect(await acting(owner, core.listSellableOffers)).toEqual([]);
      const hidden = await asRuntime(
        "org_a",
        "owner",
        "select id from commercial_offer_versions union all select id from commercial_offer_items",
      );
      expect(hidden).toHaveLength(0);

      await publishOfferVersion(catalog, draft.id, "operador");
      const [offer] = await acting(collaborator, core.listSellableOffers);
      expect(offer).toMatchObject({
        id: draft.id,
        code: "ficticio-pgr",
        version: 1,
        scope: "company",
        currency: "BRL",
        billingPeriod: "monthly",
        quotas: [{ metric: "employees", limit: 50 }],
        validFrom: "2026-01-01",
        validUntil: null,
        fictitious: true,
        items: [
          {
            service: "pgr",
            label: "PGR por empresa",
            unit: "company",
            unitAmountCents: 11111,
          },
          {
            service: "one_off",
            label: "Implantação",
            unit: "document",
            unitAmountCents: 500,
          },
        ],
      });
    });

    it("versão publicada é imutável: preço, itens e exclusão são recusados até para a conexão administrativa", async () => {
      const { id } = await publish(pgrOffer(11111));
      await expect(
        admin`update commercial_offer_versions set name = 'Outro nome' where id = ${id}`,
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        admin`update commercial_offer_items set unit_amount_cents = 1 where offer_version_id = ${id}`,
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        admin`insert into commercial_offer_items (offer_version_id, position, service, label, unit, unit_amount_cents)
              values (${id}, 9, 'pgr', 'Extra', 'company', 1)`,
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        admin`delete from commercial_offer_items where offer_version_id = ${id}`,
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        admin`delete from commercial_offer_versions where id = ${id}`,
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        admin`update commercial_offer_versions set published_at = now() where id = ${id}`,
      ).rejects.toMatchObject({ code: "23514" });
    });

    it("o runtime só lê o catálogo: inserir, alterar e excluir são negados pelo banco", async () => {
      const { id } = await publish(pgrOffer(11111));
      const statements = [
        `insert into commercial_offer_versions (code, version, name, description, scope, currency, billing_period, quotas, valid_from, fictitious, created_by)
           values ('ficticio-x', 1, 'X', '', 'company', 'BRL', 'monthly', '[]', '2026-01-01', true, 'owner')`,
        `update commercial_offer_versions set deactivated_at = now() where id = '${id}'`,
        `delete from commercial_offer_versions where id = '${id}'`,
        `update commercial_offer_items set unit_amount_cents = 0 where offer_version_id = '${id}'`,
      ];
      for (const statement of statements)
        await expect(asRuntime("org_a", "owner", statement)).rejects.toMatchObject({
          code: "42501",
        });
    });

    it("versão sem item não é publicada e oferta real sem aprovação não é gravada", async () => {
      const [{ id }] = await admin<{ id: string }[]>`
        insert into commercial_offer_versions (code, version, name, description, scope, currency, billing_period, quotas, valid_from, fictitious, created_by)
        values ('ficticio-vazia', 1, 'Vazia', '', 'company', 'BRL', 'monthly', '[]', '2026-01-01', true, 'operador')
        returning id`;
      expect(await code(() => publishOfferVersion(catalog, id, "operador"))).toBe(
        "VALIDATION",
      );
      await expect(
        admin`insert into commercial_offer_versions (code, version, name, description, scope, currency, billing_period, quotas, valid_from, fictitious, created_by)
              values ('pgr', 1, 'Real', '', 'company', 'BRL', 'monthly', '[]', '2026-01-01', false, 'operador')`,
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        admin`insert into commercial_offer_versions (code, version, name, description, scope, currency, billing_period, quotas, valid_from, fictitious, created_by)
              values ('pgr', 1, 'Fictícia sem prefixo', '', 'company', 'BRL', 'monthly', '[]', '2026-01-01', true, 'operador')`,
      ).rejects.toMatchObject({ code: "23514" });
    });

    it("publicar exige rascunho existente e desativar exige versão publicada, com motivo e uma única vez", async () => {
      const draft = await createOfferVersion(catalog, pgrOffer(11111), "operador");
      expect(await code(() => publishOfferVersion(catalog, UNKNOWN, "operador"))).toBe(
        "not_found",
      );
      expect(
        await code(() => deactivateOfferVersion(catalog, draft.id, "operador", "Erro")),
      ).toBe("not_published");
      await publishOfferVersion(catalog, draft.id, "operador");
      expect(await code(() => publishOfferVersion(catalog, draft.id, "operador"))).toBe(
        "already_published",
      );
      await deactivateOfferVersion(catalog, draft.id, "operador", "Retirada de teste");
      expect(
        await code(() =>
          deactivateOfferVersion(catalog, draft.id, "operador", "De novo"),
        ),
      ).toBe("already_deactivated");
      const [version] = await listOfferVersions(catalog);
      expect(version).toMatchObject({
        id: draft.id,
        state: "deactivated",
        publishedBy: "operador",
        deactivatedBy: "operador",
        deactivationReason: "Retirada de teste",
      });
      expect(await acting(owner, core.listSellableOffers)).toEqual([]);
    });

    it("versão agendada para o futuro ainda não está à venda", async () => {
      await publish({ ...pgrOffer(11111), validFrom: "2999-01-01" });
      expect(await acting(owner, core.listSellableOffers)).toEqual([]);
    });

    it("o catálogo fictício é semeado publicado, uma única vez, e é recusado em produção", async () => {
      const first = await seedFictitiousCatalog(catalog, { APP_ENV: "local" }, "seed");
      expect(first.created.sort()).toEqual(
        FICTITIOUS_CATALOG.map((offer) => offer.code).sort(),
      );
      const second = await seedFictitiousCatalog(catalog, { APP_ENV: "local" }, "seed");
      expect(second.created).toEqual([]);
      expect(second.skipped.sort()).toEqual(first.created.sort());
      const offers = await acting(owner, core.listSellableOffers);
      expect(offers).toHaveLength(FICTITIOUS_CATALOG.length);
      expect(offers.every((offer) => offer.fictitious && offer.version === 1)).toBe(true);

      await admin`truncate table commercial_offer_versions cascade`;
      expect(
        await code(() =>
          seedFictitiousCatalog(catalog, { APP_ENV: "production" }, "seed"),
        ),
      ).toBe("fictitious_not_allowed");
      expect(await code(() => seedFictitiousCatalog(catalog, {}, "seed"))).toBe(
        "fictitious_not_allowed",
      );
      expect(await listOfferVersions(catalog)).toEqual([]);
    });

    it("os comandos de administração criam a partir de arquivo, publicam, listam e desativam", async () => {
      const context = {
        env: { APP_ENV: "local" },
        operator: "operador",
        readJsonFile: async () => approvedOffer,
      };
      const run = (command: Parameters<typeof runCatalogCommand>[1]) =>
        runCatalogCommand(catalog, command, context);
      const created = await createOfferVersion(catalog, pgrOffer(11111), "operador");
      expect(await run({ kind: "create", file: "oferta.json" })).toMatchObject({
        code: "pgr",
        version: 1,
      });
      expect(await run({ kind: "publish", id: created.id })).toEqual({
        published: created.id,
      });
      expect(await run({ kind: "list" })).toEqual([
        {
          id: created.id,
          code: "ficticio-pgr",
          version: 1,
          state: "on_sale",
          fictitious: true,
        },
        expect.objectContaining({ code: "pgr", state: "draft", fictitious: false }),
      ]);
      expect(
        await run({ kind: "deactivate", id: created.id, reason: "Retirada de teste" }),
      ).toEqual({ deactivated: created.id });
      expect(
        await code(() =>
          runCatalogCommand(
            catalog,
            { kind: "seed-fictitious" },
            { ...context, env: { APP_ENV: "production" } },
          ),
        ),
      ).toBe("fictitious_not_allowed");
      expect(await run({ kind: "seed-fictitious" })).toMatchObject({
        skipped: ["ficticio-pgr"],
      });
    });

    it("em produção a oferta fictícia não aparece nem pode ser contratada; a aprovada sim", async () => {
      const fictitious = await publish(pgrOffer(11111));
      const approved = await publish(approvedOffer);
      const customer = await register(directCustomer);
      process.env.APP_ENV = "production";
      const offers = await acting(owner, core.listSellableOffers);
      expect(offers.map((offer) => offer.id)).toEqual([approved.id]);
      expect(
        await code(() =>
          contract({
            customerId: customer.id,
            offerVersionId: fictitious.id,
            companyIds: [I.companyA],
          }),
        ),
      ).toBe("VALIDATION");
      const real = await contract({
        customerId: customer.id,
        offerVersionId: approved.id,
        companyIds: [I.companyA],
      });
      expect(real).toMatchObject({ offerCode: "pgr", fictitious: false });
    });
  });

  describe("clientes comerciais", () => {
    it("cadastra a consultoria e o cliente direto, lista, consulta e altera", async () => {
      const office = await register(officeCustomer);
      expect(office).toMatchObject({
        kind: "office",
        companyId: null,
        legalName: "Consultoria A Ltda",
        taxId: "11444777000161",
        billingEmail: "financeiro@consultoria.test",
        status: "active",
      });
      const direct = await register(directCustomer);
      expect(direct).toMatchObject({
        kind: "company",
        companyId: I.companyA,
        legalName: "A Ltda",
        taxId: "11222333000181",
        status: "active",
      });

      const all = await acting(owner, (ctx) => core.listCustomers(ctx, {}));
      expect(all.total).toBe(2);
      expect(all.rows.map((row) => row.id).sort()).toEqual([office.id, direct.id].sort());
      const companies = await acting(owner, (ctx) =>
        core.listCustomers(ctx, { kind: "company" }),
      );
      expect(companies.rows.map((row) => row.id)).toEqual([direct.id]);
      expect(await acting(owner, (ctx) => core.getCustomer(ctx, office.id))).toEqual(
        office,
      );

      const updated = await acting(owner, (ctx) =>
        core.updateCustomer(ctx, office.id, {
          billingEmail: "novo@consultoria.test",
          status: "inactive",
          legalName: "Consultoria A S.A.",
        }),
      );
      expect(updated).toMatchObject({
        billingEmail: "novo@consultoria.test",
        status: "inactive",
        legalName: "Consultoria A S.A.",
        taxId: "11444777000161",
      });
      const inactive = await acting(owner, (ctx) =>
        core.listCustomers(ctx, { status: "inactive" }),
      );
      expect(inactive.rows.map((row) => row.id)).toEqual([office.id]);
    });

    it("recusa segunda consultoria, empresa repetida, empresa de outro escritório e identidade informada para cliente direto", async () => {
      await register(officeCustomer);
      const direct = await register(directCustomer);
      expect(await code(() => register(officeCustomer))).toBe("DUPLICATE");
      expect(await code(() => register(directCustomer))).toBe("DUPLICATE");
      expect(
        await code(() => register({ ...directCustomer, companyId: I.companyB })),
      ).toBe("FK_NOT_FOUND");
      expect(
        await code(() =>
          acting(owner, (ctx) =>
            core.updateCustomer(ctx, direct.id, {
              billingEmail: "a@empresa-a.test",
              status: "active",
              legalName: "Nome por fora",
            }),
          ),
        ),
      ).toBe("VALIDATION");
      const [{ total }] =
        await admin`select count(*)::int total from commercial_customers`;
      expect(total).toBe(2);
    });

    it("o banco não deixa trocar o tipo ou a empresa do cliente nem excluir o cadastro", async () => {
      const direct = await register(directCustomer);
      const statements = [
        `update commercial_customers set kind = 'office' where id = '${direct.id}'`,
        `update commercial_customers set company_id = '${OTHER_COMPANY}' where id = '${direct.id}'`,
        `delete from commercial_customers where id = '${direct.id}'`,
      ];
      for (const statement of statements)
        await expect(asRuntime("org_a", "owner", statement)).rejects.toMatchObject({
          code: "42501",
        });
    });

    it("empresa com cliente comercial não é excluída enquanto o cadastro existir", async () => {
      await register(directCustomer);
      await expect(
        admin`delete from companies where id = ${I.companyA}`,
      ).rejects.toMatchObject({ code: "23503" });
    });

    it("outra organização não consulta, não lista e não altera", async () => {
      const office = await register(officeCustomer);
      expect(
        await code(() => acting(outsider, (ctx) => core.getCustomer(ctx, office.id))),
      ).toBe("NOT_FOUND");
      expect(
        await code(() =>
          acting(outsider, (ctx) =>
            core.updateCustomer(ctx, office.id, {
              billingEmail: "invasor@b.test",
              status: "inactive",
            }),
          ),
        ),
      ).toBe("NOT_FOUND");
      const listed = await acting(outsider, (ctx) => core.listCustomers(ctx, {}));
      expect(listed).toEqual({ rows: [], total: 0 });
      expect(
        await asRuntime("org_b", "owner_b", "select id from commercial_customers"),
      ).toHaveLength(0);
      await expect(
        asRuntime(
          "org_b",
          "owner_b",
          `insert into commercial_customers (org_id, kind, legal_name, tax_id, billing_email, created_by)
           values ('org_a', 'office', 'Invasor', '11444777000161', 'x@b.test', 'owner_b')`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      const [row] =
        await admin`select billing_email, status from commercial_customers where id = ${office.id}`;
      expect(row).toEqual({
        billing_email: "financeiro@consultoria.test",
        status: "active",
      });
    });

    it("colaborador e cliente do escritório recebem FORBIDDEN e o banco também recusa", async () => {
      const office = await register(officeCustomer);
      for (const ctx of [collaborator, client]) {
        expect(await code(() => register(directCustomer, ctx))).toBe("FORBIDDEN");
        expect(await code(() => acting(ctx, (a) => core.listCustomers(a, {})))).toBe(
          "FORBIDDEN",
        );
        expect(await code(() => acting(ctx, (a) => core.getCustomer(a, office.id)))).toBe(
          "FORBIDDEN",
        );
        expect(await code(() => acting(ctx, (a) => core.listContracts(a, {})))).toBe(
          "FORBIDDEN",
        );
        expect(
          await asRuntime("org_a", ctx.userId, "select id from commercial_customers"),
        ).toHaveLength(0);
        await expect(
          asRuntime(
            "org_a",
            ctx.userId,
            `insert into commercial_customers (org_id, kind, company_id, billing_email, created_by)
             values ('org_a', 'company', '${I.companyA}', 'x@a.test', '${ctx.userId}')`,
          ),
        ).rejects.toMatchObject({ code: "42501" });
      }
    });

    it("o banco recusa cadastro em nome de outro usuário", async () => {
      await expect(
        asRuntime(
          "org_a",
          "owner",
          `insert into commercial_customers (org_id, kind, company_id, billing_email, created_by)
           values ('org_a', 'company', '${I.companyA}', 'x@a.test', 'collab')`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
  });

  describe("contratação", () => {
    it("cliente direto contrata para a própria empresa e não para outra", async () => {
      const offer = await publish(pgrOffer(11111));
      const customer = await register(directCustomer);
      const created = await contract({
        customerId: customer.id,
        offerVersionId: offer.id,
        companyIds: [I.companyA],
      });
      expect(created).toMatchObject({
        customerId: customer.id,
        customerKind: "company",
        customerLegalName: "A Ltda",
        customerTaxId: "11222333000181",
        companyIds: [I.companyA],
        contractedBy: "owner",
      });
      expect(
        await code(() =>
          contract({
            customerId: customer.id,
            offerVersionId: offer.id,
            companyIds: [OTHER_COMPANY],
          }),
        ),
      ).toBe("VALIDATION");
    });

    it("consultoria paga por várias empresas do escritório e nunca por empresa de outro", async () => {
      const offer = await publish(pgrOffer(11111));
      const customer = await register(officeCustomer);
      const created = await contract({
        customerId: customer.id,
        offerVersionId: offer.id,
        companyIds: [OTHER_COMPANY, I.companyA],
      });
      expect(created.customerKind).toBe("office");
      expect([...created.companyIds].sort()).toEqual([I.companyA, OTHER_COMPANY].sort());
      expect(
        await code(() =>
          contract({ customerId: customer.id, offerVersionId: offer.id, companyIds: [] }),
        ),
      ).toBe("VALIDATION");
      expect(
        await code(() =>
          contract({
            customerId: customer.id,
            offerVersionId: offer.id,
            companyIds: [I.companyA, I.companyB],
          }),
        ),
      ).toBe("FK_NOT_FOUND");
      const [{ total }] =
        await admin`select count(*)::int total from commercial_contracts`;
      expect(total).toBe(1);
    });

    it("oferta por escritório é contratada pela consultoria, sem empresas", async () => {
      const offer = await publish(proOffer);
      const office = await register(officeCustomer);
      const direct = await register(directCustomer);
      const created = await contract({
        customerId: office.id,
        offerVersionId: offer.id,
        companyIds: [],
      });
      expect(created).toMatchObject({ offerScope: "organization", companyIds: [] });
      expect(
        await code(() =>
          contract({ customerId: direct.id, offerVersionId: offer.id, companyIds: [] }),
        ),
      ).toBe("VALIDATION");
    });

    it("preço novo publicado vale só para novas compras; o contrato anterior retém valor, itens, cotas e vigência", async () => {
      const v1 = await publish(pgrOffer(11111));
      const customer = await register(officeCustomer);
      const before = await contract({
        customerId: customer.id,
        offerVersionId: v1.id,
        companyIds: [I.companyA],
        termStart: "2026-11-01",
        termEnd: "2027-10-31",
      });

      const v2 = await publish({
        ...pgrOffer(22222),
        quotas: [{ metric: "employees", limit: 10 }],
      });
      expect(v2.version).toBe(2);
      const offers = await acting(owner, core.listSellableOffers);
      expect(offers.map((offer) => [offer.id, offer.items[0].unitAmountCents])).toEqual([
        [v2.id, 22222],
      ]);
      expect(
        await code(() =>
          contract({
            customerId: customer.id,
            offerVersionId: v1.id,
            companyIds: [I.companyA],
          }),
        ),
      ).toBe("VALIDATION");
      const after = await contract({
        customerId: customer.id,
        offerVersionId: v2.id,
        companyIds: [I.companyA],
      });
      expect(after).toMatchObject({ offerVersion: 2 });
      expect(after.items[0].unitAmountCents).toBe(22222);

      const kept = await acting(owner, (ctx) => core.getContract(ctx, before.id));
      expect(kept).toEqual(before);
      expect(kept).toMatchObject({
        offerVersionId: v1.id,
        offerCode: "ficticio-pgr",
        offerVersion: 1,
        currency: "BRL",
        billingPeriod: "monthly",
        quotas: [{ metric: "employees", limit: 50 }],
        termStart: "2026-11-01",
        termEnd: "2027-10-31",
        fictitious: true,
      });
      expect(kept.items).toEqual([
        {
          position: 1,
          service: "pgr",
          label: "PGR por empresa",
          unit: "company",
          unitAmountCents: 11111,
        },
        {
          position: 2,
          service: "one_off",
          label: "Implantação",
          unit: "document",
          unitAmountCents: 500,
        },
      ]);
      const listed = await acting(owner, (ctx) => core.listContracts(ctx, {}));
      expect(listed.total).toBe(2);
      expect(listed.rows.map((row) => row.id)).toEqual([after.id, before.id]);
    });

    it("desativar a versão nova devolve a anterior às novas compras e não toca o contrato já feito", async () => {
      const v1 = await publish(pgrOffer(11111));
      const v2 = await publish(pgrOffer(22222));
      const customer = await register(directCustomer);
      const made = await contract({
        customerId: customer.id,
        offerVersionId: v2.id,
        companyIds: [I.companyA],
      });
      await deactivateOfferVersion(catalog, v2.id, "operador", "Preço publicado errado");
      const offers = await acting(owner, core.listSellableOffers);
      expect(offers.map((offer) => offer.id)).toEqual([v1.id]);
      expect(
        await code(() =>
          contract({
            customerId: customer.id,
            offerVersionId: v2.id,
            companyIds: [I.companyA],
          }),
        ),
      ).toBe("VALIDATION");
      expect(await acting(owner, (ctx) => core.getContract(ctx, made.id))).toEqual(made);
    });

    it("o registro da contratação é só de inclusão: o banco recusa alterar e excluir", async () => {
      const offer = await publish(pgrOffer(11111));
      const customer = await register(directCustomer);
      const made = await contract({
        customerId: customer.id,
        offerVersionId: offer.id,
        companyIds: [I.companyA],
      });
      const statements = [
        `update commercial_contracts set term_end = '2030-01-01' where id = '${made.id}'`,
        `delete from commercial_contracts where id = '${made.id}'`,
        `update commercial_contract_items set unit_amount_cents = 1 where contract_id = '${made.id}'`,
        `delete from commercial_contract_items where contract_id = '${made.id}'`,
        `delete from commercial_contract_companies where contract_id = '${made.id}'`,
      ];
      for (const statement of statements)
        await expect(asRuntime("org_a", "owner", statement)).rejects.toMatchObject({
          code: "42501",
        });
    });

    it("recusa cliente inativo, cliente de outra organização e versão inexistente", async () => {
      const offer = await publish(pgrOffer(11111));
      const customer = await register(directCustomer);
      await acting(owner, (ctx) =>
        core.updateCustomer(ctx, customer.id, {
          billingEmail: "financeiro@empresa-a.test",
          status: "inactive",
        }),
      );
      const attempt = (ctx: TenantContext, input: Record<string, unknown>) =>
        code(() =>
          contract(
            {
              customerId: customer.id,
              offerVersionId: offer.id,
              companyIds: [I.companyA],
              ...input,
            },
            ctx,
          ),
        );
      expect(await attempt(owner, {})).toBe("VALIDATION");
      expect(await attempt(outsider, { companyIds: [I.companyB] })).toBe("FK_NOT_FOUND");
      expect(await attempt(owner, { offerVersionId: UNKNOWN })).toBe("VALIDATION");
      const [{ total }] =
        await admin`select count(*)::int total from commercial_contracts`;
      expect(total).toBe(0);
    });

    it("outra organização não consulta nem lista os contratos", async () => {
      const offer = await publish(pgrOffer(11111));
      const customer = await register(directCustomer);
      const made = await contract({
        customerId: customer.id,
        offerVersionId: offer.id,
        companyIds: [I.companyA],
      });
      expect(
        await code(() => acting(outsider, (ctx) => core.getContract(ctx, made.id))),
      ).toBe("NOT_FOUND");
      expect(await acting(outsider, (ctx) => core.listContracts(ctx, {}))).toEqual({
        rows: [],
        total: 0,
      });
      const visible = await asRuntime(
        "org_b",
        "owner_b",
        `select org_id from commercial_contracts
         union all select org_id from commercial_contract_items
         union all select org_id from commercial_contract_companies`,
      );
      expect(visible).toHaveLength(0);
    });

    it("contratar não altera plano, dados do Stripe nem serviços habilitados por empresa", async () => {
      const before = await licenses();
      const offer = await publish(pgrOffer(11111));
      const pro = await publish(proOffer);
      const office = await register(officeCustomer);
      await contract({
        customerId: office.id,
        offerVersionId: offer.id,
        companyIds: [I.companyA, OTHER_COMPANY],
      });
      await contract({ customerId: office.id, offerVersionId: pro.id, companyIds: [] });
      expect(await licenses()).toEqual(before);
    });
  });

  describe("superfície desligada por padrão", () => {
    it("sem a flag toda entrada responde FORBIDDEN e nada é gravado", async () => {
      const offer = await publish(pgrOffer(11111));
      delete process.env.COMMERCIAL_CATALOG_ENABLED;
      expect(await code(() => acting(owner, core.listSellableOffers))).toBe("FORBIDDEN");
      expect(await code(() => register(officeCustomer))).toBe("FORBIDDEN");
      expect(await code(() => acting(owner, (ctx) => core.listCustomers(ctx, {})))).toBe(
        "FORBIDDEN",
      );
      expect(
        await code(() =>
          contract({
            customerId: UNKNOWN,
            offerVersionId: offer.id,
            companyIds: [I.companyA],
          }),
        ),
      ).toBe("FORBIDDEN");
      const offers = await offersRoute.GET(request("/api/v1/commercial-offers", "GET"));
      expect(offers.status).toBe(403);
      const [{ total }] =
        await admin`select count(*)::int total from commercial_customers`;
      expect(total).toBe(0);
    });
  });

  describe("Server Actions e REST", () => {
    it("as actions devolvem o resultado tipado e bloqueiam quem não é da equipe", async () => {
      const offer = await publish(pgrOffer(11111));
      const offers = await listCommercialOffersAction();
      expect(offers).toMatchObject({ ok: true, data: [{ id: offer.id }] });
      const customer = await registerCommercialCustomerAction(directCustomer);
      expect(customer).toMatchObject({ ok: true, data: { kind: "company" } });
      const invalid = await registerCommercialCustomerAction({ kind: "company" });
      expect(invalid).toMatchObject({ ok: false, error: { code: "VALIDATION" } });

      mockStaff.mockResolvedValue(collaborator);
      const blocked = await registerCommercialContractAction({
        customerId: UNKNOWN,
        offerVersionId: offer.id,
        companyIds: [I.companyA],
        termStart: "2026-11-13",
        termEnd: null,
      });
      expect(blocked).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    });

    it("REST cobre catálogo, clientes e contratos com os verbos e códigos do contrato", async () => {
      const offer = await publish(pgrOffer(11111));
      const offers = await offersRoute.GET(request("/api/v1/commercial-offers", "GET"));
      expect(offers.status).toBe(200);
      expect(await offers.json()).toMatchObject([{ id: offer.id, version: 1 }]);

      const created = await customersRoute.POST(
        request("/api/v1/commercial-customers", "POST", directCustomer),
      );
      expect(created.status).toBe(201);
      const customer: { id: string } = await created.json();
      const duplicate = await customersRoute.POST(
        request("/api/v1/commercial-customers", "POST", directCustomer),
      );
      expect(duplicate.status).toBe(409);
      const list = await customersRoute.GET(
        request("/api/v1/commercial-customers?kind=company&pageSize=5", "GET"),
      );
      expect(await list.json()).toMatchObject({ total: 1, rows: [{ id: customer.id }] });
      const fetched = await customerRoute.GET(
        request(`/api/v1/commercial-customers/${customer.id}`, "GET"),
        params(customer.id),
      );
      expect(fetched.status).toBe(200);
      const updated = await customerRoute.PUT(
        request(`/api/v1/commercial-customers/${customer.id}`, "PUT", {
          billingEmail: "novo@empresa-a.test",
          status: "active",
        }),
        params(customer.id),
      );
      expect(await updated.json()).toMatchObject({ billingEmail: "novo@empresa-a.test" });

      const contracted = await contractsRoute.POST(
        request("/api/v1/commercial-contracts", "POST", {
          customerId: customer.id,
          offerVersionId: offer.id,
          companyIds: [I.companyA],
          termStart: "2026-11-13",
          termEnd: null,
        }),
      );
      expect(contracted.status).toBe(201);
      const made: { id: string } = await contracted.json();
      const contracts = await contractsRoute.GET(
        request(`/api/v1/commercial-contracts?customerId=${customer.id}`, "GET"),
      );
      expect(await contracts.json()).toMatchObject({ total: 1, rows: [{ id: made.id }] });
      const detail = await contractRoute.GET(
        request(`/api/v1/commercial-contracts/${made.id}`, "GET"),
        params(made.id),
      );
      expect(await detail.json()).toMatchObject({
        id: made.id,
        companyIds: [I.companyA],
        items: [{ unitAmountCents: 11111 }, { unitAmountCents: 500 }],
      });

      const foreign = await contractRoute.GET(
        request(
          `/api/v1/commercial-contracts/${made.id}`,
          "GET",
          undefined,
          "owner",
          "org_b",
        ),
        params(made.id),
      );
      expect(foreign.status).toBe(404);
      const invalid = await contractsRoute.POST(
        request("/api/v1/commercial-contracts", "POST", { customerId: customer.id }),
      );
      expect(invalid.status).toBe(422);
    });

    it("REST responde 403 para o papel client e para colaborador em dado financeiro", async () => {
      const asClient = await customersRoute.GET(
        request("/api/v1/commercial-customers", "GET", undefined, "client"),
      );
      expect(asClient.status).toBe(403);
      const clientOffers = await offersRoute.GET(
        request("/api/v1/commercial-offers", "GET", undefined, "client"),
      );
      expect(clientOffers.status).toBe(403);
      const asCollaborator = await customersRoute.POST(
        request("/api/v1/commercial-customers", "POST", officeCustomer, "collaborator"),
      );
      expect(asCollaborator.status).toBe(403);
      const [{ total }] =
        await admin`select count(*)::int total from commercial_customers`;
      expect(total).toBe(0);
    });
  });
});
