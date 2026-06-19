import postgres from "postgres";

import { adminClient, applyMigrations } from "../../_helpers/db";

const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!ADMIN_URL;

type IdRow = { id: string };

(shouldRun ? describe : describe.skip)(
  "US5 — companies como dimensão + escopo do papel cliente (modelo)",
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
      await admin.unsafe(`
        insert into public.orgs (id, plan) values ('org_a','pro'), ('org_b','free');
        insert into public.users (id) values ('user_1'), ('user_2');
      `);
    });

    it("mesmo cnpj em dois escritórios → duas companies distintas (FR-018/SC-011)", async () => {
      const rows = await admin<IdRow[]>`
        insert into public.companies (org_id, cnpj) values
          ('org_a','12345678000199'),
          ('org_b','12345678000199')
        returning id
      `;
      expect(rows).toHaveLength(2);
      expect(rows[0].id).not.toBe(rows[1].id);
    });

    it("uq_companies_org_id_cnpj rejeita cnpj duplicado INTRA-tenant", async () => {
      await admin`insert into public.companies (org_id, cnpj) values ('org_a','77777777000177')`;
      await expect(
        admin`insert into public.companies (org_id, cnpj) values ('org_a','77777777000177')`,
      ).rejects.toThrow();
    });

    it("org_memberships.scoped_company_id aceita FK válida", async () => {
      const [company] = await admin<IdRow[]>`
        insert into public.companies (org_id, cnpj) values ('org_a','55555555000155') returning id
      `;
      const rows = await admin<IdRow[]>`
        insert into public.org_memberships (org_id, user_id, role, scoped_company_id)
        values ('org_a','user_1','client', ${company.id})
        returning user_id as id
      `;
      expect(rows).toHaveLength(1);
    });

    it("org_memberships.scoped_company_id rejeita id de company inexistente (FK)", async () => {
      await expect(
        admin`
          insert into public.org_memberships (org_id, user_id, role, scoped_company_id)
          values ('org_b','user_2','client','00000000-0000-0000-0000-000000000000')
        `,
      ).rejects.toThrow();
    });
  },
);
