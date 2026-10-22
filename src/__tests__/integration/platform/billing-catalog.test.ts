import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn().mockResolvedValue({
    tenantId: "org_a",
    userId: "owner",
    role: "owner",
    plan: "free",
  }),
}));
import { adminClient, applyMigrations, withOrgTx } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import {
  createBillingOffer,
  getBillingCatalog,
  createBillingCustomer,
  getBillingCustomers,
} from "@/shared/server/platform/billing-catalog-core";
import { createBillingOfferAction } from "@/shared/server/actions/platform/billing-catalog";
import { POST } from "@/app/api/billing/plans/route";
const owner = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free" as const,
};
const input = {
  code: "catalog-test",
  name: "Oferta fictícia",
  interval: "month",
  items: [{ product: "pgr", label: "PGR", amountMinor: 10000 }],
  limits: { companies: null, employees: null },
  policy: {},
  reason: "Cadastro sintético",
};
(process.env.INTEGRATION_APP_RUNTIME_URL ? describe : describe.skip)(
  "billing catalog",
  () => {
    let admin: ReturnType<typeof postgres>, runtime: ReturnType<typeof postgres>;
    beforeAll(async () => {
      process.env.APP_ENV = "test";
      process.env.BILLING_MODE = "mock";
      process.env.BILLING_MOCK_ENABLED = "true";
      admin = adminClient();
      await applyMigrations(admin);
      runtime = (await import("postgres")).default(
        process.env.INTEGRATION_APP_RUNTIME_URL!,
        { max: 1, prepare: false },
      );
    });
    beforeEach(async () => {
      await seedPgrBase(admin);
      await admin`insert into users (id,email) values ('owner','catalog-test@example.invalid') on conflict do nothing`;
      await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner') on conflict (org_id,user_id) do update set role='owner'`;
    });
    afterAll(async () => {
      await runtime?.end({ timeout: 5 });
      await admin?.end({ timeout: 5 });
    });
    it("registers the same company once without exposing provider metadata and rejects another organization", async () => {
      const one = await createBillingCustomer(owner, { companyId: I.companyA });
      const two = await createBillingCustomer(owner, { companyId: I.companyA });
      expect(two).toEqual(one);
      expect(one).not.toHaveProperty("providerCustomerId");
      expect(await getBillingCustomers(owner)).toHaveLength(1);
      await expect(
        createBillingCustomer(owner, { companyId: I.companyB }),
      ).rejects.toThrow();
      await expect(
        createBillingCustomer(owner, {
          companyId: I.companyA,
          email: "untrusted@example.invalid",
        }),
      ).rejects.toThrow();
    });
    it("versions concurrent edits, lists only latest prices and enforces immutability in app_runtime", async () => {
      const one = await createBillingOffer(owner, input);
      const [two, three] = await Promise.all([
        createBillingOffer(owner, { ...input, name: "Segunda versão" }),
        createBillingOffer(owner, { ...input, name: "Terceira versão" }),
      ]);
      expect([two.version, three.version].sort()).toEqual([2, 3]);
      expect((await getBillingCatalog(owner))[0].version).toBe(3);
      expect(
        (await admin`select data from billing_offer_versions where id=${one.id}`)[0].data
          .items,
      ).toEqual(input.items);
      await expect(
        withOrgTx(runtime, "org_a", async (tx) => {
          await tx`select set_config('app.current_actor','owner',true)`;
          return tx`update billing_offer_versions set version=20`;
        }),
      ).rejects.toThrow();
    });
    it("uses the same validated owner gate for Actions and REST, refuses card data and production", async () => {
      const action = await createBillingOfferAction(input);
      expect(action.ok).toBe(true);
      const response = await POST(
        new NextRequest("http://localhost/api/billing/plans", {
          method: "POST",
          body: JSON.stringify({ ...input, code: "rest-offer" }),
        }),
      );
      expect(response.status).toBe(201);
      await expect(
        createBillingOffer({ ...owner, role: "collaborator" }, input),
      ).rejects.toThrow();
      await expect(
        createBillingOffer(owner, { ...input, cardNumber: "0000" }),
      ).rejects.toThrow();
      process.env.APP_ENV = "production";
      try {
        await expect(getBillingCatalog(owner)).rejects.toThrow();
      } finally {
        process.env.APP_ENV = "test";
      }
    });
  },
);
