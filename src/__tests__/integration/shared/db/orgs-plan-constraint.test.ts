import postgres from "postgres";

import { adminClient, applyMigrations } from "../../_helpers/db";

const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!ADMIN_URL;

type PlanRow = { plan: string };

(shouldRun ? describe : describe.skip)(
  "US3 — orgs.plan constraint (default + CHECK)",
  () => {
    let admin: ReturnType<typeof postgres>;

    beforeAll(async () => {
      admin = adminClient();
      await applyMigrations(admin);
    });

    afterAll(async () => {
      await admin.end({ timeout: 5 });
    });

    beforeEach(async () => {
      await admin.unsafe(
        "truncate table public.companies, public.org_memberships, public.orgs, public.users restart identity cascade;",
      );
    });

    it("insert sem plan → default 'free' (SC-006)", async () => {
      const rows = await admin<PlanRow[]>`
        insert into public.orgs (id) values ('o_default') returning plan
      `;
      expect(rows[0].plan).toBe("free");
    });

    it("insert plan='pro' → aceito", async () => {
      const rows = await admin<PlanRow[]>`
        insert into public.orgs (id, plan) values ('o_pro','pro') returning plan
      `;
      expect(rows[0].plan).toBe("pro");
    });

    it("insert com plan inválido → rejeitado pelo CHECK", async () => {
      await expect(
        admin`insert into public.orgs (id, plan) values ('o_bad','enterprise')`,
      ).rejects.toThrow();
    });

    it("UPDATE plan='x' em linha existente → rejeitado pelo CHECK (SC-006)", async () => {
      await admin`insert into public.orgs (id, plan) values ('o1','free')`;
      await expect(
        admin`update public.orgs set plan = 'x' where id = 'o1'`,
      ).rejects.toThrow();
    });
  },
);
