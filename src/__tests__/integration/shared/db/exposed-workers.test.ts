import postgres from "postgres";

import { adminClient, applyMigrations, withOrgTx } from "../../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const GES_X = "11111111-1111-1111-1111-1111111111c1";
const ROLE_2 = "11111111-1111-1111-1111-1111111111c2";

(shouldRun ? describe : describe.skip)(
  "US3 — nº de trabalhadores expostos por GES (derivado SUM)",
  () => {
    let admin: ReturnType<typeof postgres>;
    let runtime: ReturnType<typeof postgres>;

    async function sumExposed(orgId: string, gesId: string): Promise<number> {
      return withOrgTx(runtime, orgId, async (tx) => {
        const rows = await tx<{ total: number }[]>`
          select coalesce(sum(worker_count), 0)::int as total
          from public.ges_job_roles where ges_id = ${gesId}`;
        return rows[0].total;
      });
    }

    beforeAll(async () => {
      admin = adminClient();
      await applyMigrations(admin);
      runtime = postgres(APP_RUNTIME_URL!, { max: 1, prepare: false });
    });

    afterAll(async () => {
      await runtime.end({ timeout: 5 });
      await admin.end({ timeout: 5 });
    });

    beforeEach(async () => {
      await seedPgrBase(admin);
      await admin`insert into public.ges (id, org_id, company_id, work_unit_id, name)
        values (${GES_X}, 'org_a', ${I.companyA}, ${I.workUnitA}, 'GES X')`;
      await admin`insert into public.job_roles (id, org_id, company_id, title)
        values (${ROLE_2}, 'org_a', ${I.companyA}, 'Servente')`;
    });

    it("GES sem associação → 0", async () => {
      expect(await sumExposed("org_a", GES_X)).toBe(0);
    });

    it("com associações (3 e 2) → 5; remover uma → 3; alterar → reflete", async () => {
      await admin`insert into public.ges_job_roles (org_id, ges_id, job_role_id, worker_count)
        values ('org_a', ${GES_X}, ${I.jobRoleA}, 3), ('org_a', ${GES_X}, ${ROLE_2}, 2)`;
      expect(await sumExposed("org_a", GES_X)).toBe(5);

      await admin`delete from public.ges_job_roles
        where org_id = 'org_a' and ges_id = ${GES_X} and job_role_id = ${ROLE_2}`;
      expect(await sumExposed("org_a", GES_X)).toBe(3);

      await admin`update public.ges_job_roles set worker_count = 10
        where org_id = 'org_a' and ges_id = ${GES_X} and job_role_id = ${I.jobRoleA}`;
      expect(await sumExposed("org_a", GES_X)).toBe(10);
    });

    it("a soma não cruza tenants (associações de org_b não entram em org_a)", async () => {
      // gesB já tem associação worker_count=7 em org_b (seed); sob org_a → invisível.
      expect(await sumExposed("org_a", I.gesB)).toBe(0);
      expect(await sumExposed("org_b", I.gesB)).toBe(7);
    });
  },
);
