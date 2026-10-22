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
import { startCommercialTrial } from "@/shared/server/platform/billing-trials-core";
import {
  registerCommercialInterest,
  getCommercialInterests,
  acknowledgeCommercialInterest,
} from "@/shared/server/platform/billing-interests-core";
import { registerCommercialInterestAction } from "@/shared/server/actions/platform/billing-interests";
import { POST } from "@/app/api/billing/interests/route";
const owner = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free" as const,
};
(process.env.INTEGRATION_APP_RUNTIME_URL ? describe : describe.skip)(
  "explicit commercial interest and internal alerts",
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
      await admin`insert into users (id,email) values ('owner','interests@example.invalid'),('collaborator','collaborator-interests@example.invalid') on conflict do nothing`;
      await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','collaborator','collaborator') on conflict (org_id,user_id) do update set role=excluded.role`;
    });
    afterAll(async () => {
      await runtime?.end({ timeout: 5 });
      await admin?.end({ timeout: 5 });
    });
    async function interest() {
      const trial = await startCommercialTrial(owner, { companyId: I.companyA });
      return {
        trialId: trial.id,
        interest: "both",
        message: "Quero conversar sobre os serviços",
      };
    }
    it("deduplicates concurrent requests per company/trial/interest without sending external notifications", async () => {
      const input = await interest();
      await Promise.all([
        registerCommercialInterest(owner, input),
        registerCommercialInterest(owner, input),
      ]);
      const result = await getCommercialInterests(owner, {
        status: "pending",
        companyId: I.companyA,
      });
      expect(result.channel).toBe("inbox");
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].trialId).toBe(input.trialId);
      expect(result.rows[0].message).toBe(input.message);
      expect(
        await admin`select * from billing_audit where action='interest.registered'`,
      ).toHaveLength(1);
      await expect(
        registerCommercialInterest(owner, {
          ...input,
          channel: "email",
          email: "unapproved@example.invalid",
        }),
      ).rejects.toThrow();
    });
    it("acknowledges once with audit and supports status filters without rewriting the original interest", async () => {
      await registerCommercialInterest(owner, await interest());
      const row = (await getCommercialInterests(owner)).rows[0];
      await acknowledgeCommercialInterest(owner, {
        id: row.id,
        reason: "Visto pelo administrador",
      });
      await acknowledgeCommercialInterest(owner, {
        id: row.id,
        reason: "Repetição da consulta",
      });
      expect(
        (await getCommercialInterests(owner, { status: "pending" })).rows,
      ).toHaveLength(0);
      expect(
        (await getCommercialInterests(owner, { status: "acknowledged" })).rows[0].message,
      ).toBe(row.message);
      expect(
        await admin`select * from billing_audit where action='interest.acknowledged'`,
      ).toHaveLength(1);
    });
    it("denies collaborators and isolates financial alerts by tenant at both the server and RLS", async () => {
      await registerCommercialInterest(owner, await interest());
      await expect(
        getCommercialInterests({
          ...owner,
          userId: "collaborator",
          role: "collaborator",
        }),
      ).rejects.toThrow();
      expect(
        await withOrgTx(runtime, "org_a", async (tx) => {
          await tx`select set_config('app.current_actor','collaborator',true)`;
          return tx`select * from billing_interests`;
        }),
      ).toHaveLength(0);
      expect(
        await withOrgTx(runtime, "org_b", async (tx) => {
          await tx`select set_config('app.current_actor','owner',true)`;
          return tx`select * from billing_interests`;
        }),
      ).toHaveLength(0);
      const [foreign] =
        await admin`insert into billing_trials (org_id,company_id,started_at,ends_at,created_by) values ('org_b',${I.companyB},now(),now()+interval '15 days','owner') returning id`;
      await expect(
        registerCommercialInterest(owner, {
          trialId: foreign.id,
          interest: "pgr",
          message: "",
        }),
      ).rejects.toThrow();
    });
    it("shares validated behavior between Actions and REST, with bounded pagination", async () => {
      const input = await interest();
      expect((await registerCommercialInterestAction(input)).ok).toBe(true);
      expect(
        (
          await POST(
            new NextRequest("http://localhost/api/billing/interests", {
              method: "POST",
              body: JSON.stringify(input),
            }),
          )
        ).status,
      ).toBe(201);
      expect((await getCommercialInterests(owner)).rows).toHaveLength(1);
      await expect(getCommercialInterests(owner, { page: 0 })).rejects.toThrow();
    });
  },
);
