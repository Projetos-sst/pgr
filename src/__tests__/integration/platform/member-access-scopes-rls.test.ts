import postgres from "postgres";

import {
  adminClient,
  applyMigrations,
  requireIntegrationDatabaseUrl,
} from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import { ACCESS_IDS as X, seedAccessScopeFixtures } from "../_helpers/access-scope-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;

type Sql = ReturnType<typeof postgres>;
type Session = { org: string; actor: string | null };
type Grant = { user: string; company: string; workUnit?: string; area: string };

type ScopePolicy = { tablename: string; qual: string };

function scopeBoundTables(policies: ScopePolicy[]): Set<string> {
  const bound = new Set(["member_access_scopes"]);
  const readsBoundTable = (policy: ScopePolicy) =>
    [...policy.qual.matchAll(/\bfrom (\w+)/gi)].some((match) => bound.has(match[1]));
  for (let size = 0; size !== bound.size; ) {
    size = bound.size;
    policies.filter(readsBoundTable).forEach((policy) => bound.add(policy.tablename));
  }
  return bound;
}

(enabled ? describe : describe.skip)("member access scopes — RLS", () => {
  let admin: Sql;
  let runtime: Sql;

  async function ids(session: Session, table: string, where = "true"): Promise<string[]> {
    const rows = await runtime.begin(async (tx) => {
      await tx`select set_config('app.current_org', ${session.org}, true)`;
      if (session.actor)
        await tx`select set_config('app.current_actor', ${session.actor}, true)`;
      return tx.unsafe(`select id::text as id from public.${table} where ${where}`);
    });
    return rows.map((row) => String(row.id)).sort();
  }

  async function write(session: Session, statement: string): Promise<number> {
    return runtime.begin(async (tx) => {
      await tx`select set_config('app.current_org', ${session.org}, true)`;
      if (session.actor)
        await tx`select set_config('app.current_actor', ${session.actor}, true)`;
      const result = await tx.unsafe(statement);
      return result.count;
    });
  }

  async function grant(scope: Grant): Promise<void> {
    await admin`insert into member_access_scopes
      (org_id, user_id, company_id, work_unit_id, area, granted_by)
      values ('org_a', ${scope.user}, ${scope.company}, ${scope.workUnit ?? null},
        ${scope.area}, ${X.owner})`;
  }

  const office = (actor: string | null): Session => ({ org: "org_a", actor });

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    runtime = postgres(requireIntegrationDatabaseUrl(), { max: 1, prepare: false });
  });
  afterAll(async () => {
    await runtime?.end({ timeout: 5 });
    await admin?.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    await seedAccessScopeFixtures(admin);
  });

  it("keeps full access for sessions without actor and for members without scope rows", async () => {
    const everything = [I.companyA, X.companyA2].sort();
    expect(await ids(office(null), "companies")).toEqual(everything);
    expect(await ids(office(X.legacy), "companies")).toEqual(everything);
    expect(await ids(office(X.legacy), "pgr")).toHaveLength(4);
    expect(await ids(office(X.legacy), "health_exams")).toHaveLength(2);
    expect(await ids(office(X.representative), "companies")).toEqual(everything);
  });

  it("never restricts the office administrator, whatever the stored role spelling", async () => {
    await grant({ user: X.owner, company: I.companyA, area: "health" });
    await grant({ user: X.clerkAdmin, company: I.companyA, area: "health" });
    for (const administrator of [X.owner, X.clerkAdmin]) {
      expect(await ids(office(administrator), "companies")).toHaveLength(2);
      expect(await ids(office(administrator), "pgr")).toHaveLength(4);
      expect(await ids(office(administrator), "health_exams")).toHaveLength(2);
    }
  });

  it("limits a scoped collaborator to the granted company in every company-bound table", async () => {
    await grant({ user: X.scoped, company: I.companyA, area: "safety" });
    const session = office(X.scoped);
    expect(await ids(session, "companies")).toEqual([I.companyA]);
    expect(await ids(session, "companies", `id = '${X.companyA2}'`)).toEqual([]);
    expect(await ids(session, "work_units")).toEqual([I.workUnitA, X.workUnitA_2].sort());
    expect(await ids(session, "ges")).toEqual([I.gesA, X.gesA_2].sort());
    expect(await ids(session, "employees")).toEqual([I.employeeA]);
    expect(await ids(session, "job_roles")).toEqual([I.jobRoleA]);
    expect(await ids(session, "accidents")).toEqual([X.accidentA]);
    expect(await ids(session, "pgr")).toEqual(
      [I.pgrA, X.pgrA_workUnit2, X.pgrA_companyWide].sort(),
    );
    expect(await ids(session, "pgr_revisions")).toEqual([I.pgrRevisionA]);
    expect(await ids(session, "risks")).toEqual([I.riskA]);
    expect(await ids(session, "risks", `id = '${X.riskA2}'`)).toEqual([]);
  });

  it("separates safety and health inside the same company", async () => {
    await grant({ user: X.scoped, company: I.companyA, area: "safety" });
    expect(await ids(office(X.scoped), "health_exams")).toEqual([]);
    expect(await ids(office(X.scoped), "pgr")).toHaveLength(3);

    await grant({ user: X.healthOnly, company: I.companyA, area: "health" });
    const health = office(X.healthOnly);
    expect(await ids(health, "health_exams")).toEqual([X.examA]);
    expect(await ids(health, "pgr")).toEqual([]);
    expect(await ids(health, "pgr", `id = '${I.pgrA}'`)).toEqual([]);
    expect(await ids(health, "risks")).toEqual([]);
    expect(await ids(health, "companies")).toEqual([I.companyA]);
    expect(await ids(health, "employees")).toEqual([I.employeeA]);
    expect(await ids(health, "accidents")).toEqual([X.accidentA]);

    await grant({ user: X.healthOnly, company: I.companyA, area: "safety" });
    expect(await ids(health, "health_exams")).toEqual([X.examA]);
    expect(await ids(health, "pgr")).toHaveLength(3);
  });

  it("limits a work-unit grant to that work unit and to company-wide records", async () => {
    await grant({
      user: X.scoped,
      company: I.companyA,
      workUnit: I.workUnitA,
      area: "safety",
    });
    const session = office(X.scoped);
    expect(await ids(session, "work_units")).toEqual([I.workUnitA]);
    expect(await ids(session, "work_units", `id = '${X.workUnitA_2}'`)).toEqual([]);
    expect(await ids(session, "ges")).toEqual([I.gesA]);
    expect(await ids(session, "pgr")).toEqual([I.pgrA, X.pgrA_companyWide].sort());
    expect(await ids(session, "pgr", `id = '${X.pgrA_workUnit2}'`)).toEqual([]);
    expect(await ids(session, "employees")).toEqual([I.employeeA]);
  });

  it("grants several companies to the same account, including a company representative", async () => {
    await grant({ user: X.representative, company: I.companyA, area: "safety" });
    expect(await ids(office(X.representative), "companies")).toEqual([I.companyA]);
    await grant({ user: X.representative, company: X.companyA2, area: "safety" });
    expect(await ids(office(X.representative), "companies")).toEqual(
      [I.companyA, X.companyA2].sort(),
    );
    expect(await ids(office(X.representative), "pgr")).toHaveLength(4);
    expect(await ids(office(X.representative), "health_exams")).toEqual([]);
  });

  it("reflects a revocation on the very next transaction", async () => {
    await grant({ user: X.scoped, company: I.companyA, area: "safety" });
    await grant({ user: X.scoped, company: X.companyA2, area: "safety" });
    expect(await ids(office(X.scoped), "companies")).toHaveLength(2);
    await admin`delete from member_access_scopes
      where user_id = ${X.scoped} and company_id = ${X.companyA2}`;
    expect(await ids(office(X.scoped), "companies")).toEqual([I.companyA]);
    expect(await ids(office(X.scoped), "pgr", `id = '${X.pgrA2}'`)).toEqual([]);
  });

  it("keeps scopes inside their office", async () => {
    await grant({ user: X.scoped, company: I.companyA, area: "safety" });
    await admin`insert into org_memberships (org_id, user_id, role)
      values ('org_b', ${X.scoped}, 'collaborator')`;
    expect(await ids({ org: "org_b", actor: X.scoped }, "companies")).toEqual([
      I.companyB,
    ]);
    expect(await ids(office(X.scoped), "companies", `id = '${I.companyB}'`)).toEqual([]);
    expect(await ids({ org: "org_b", actor: X.scoped }, "member_access_scopes")).toEqual(
      [],
    );
  });

  it("blocks writes outside the granted scope", async () => {
    await grant({
      user: X.scoped,
      company: I.companyA,
      workUnit: I.workUnitA,
      area: "safety",
    });
    const session = office(X.scoped);
    await expect(
      write(
        session,
        `insert into employees (org_id, company_id, full_name, cpf)
         values ('org_a','${X.companyA2}','Intruso','00000000191')`,
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      write(
        session,
        `insert into pgr (org_id, company_id, work_unit_id)
         values ('org_a','${I.companyA}','${X.workUnitA_2}')`,
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      await write(
        session,
        `update companies set nome_fantasia = 'x' where id = '${X.companyA2}'`,
      ),
    ).toBe(0);
    expect(
      await write(session, `delete from work_units where id = '${X.workUnitA_2}'`),
    ).toBe(0);
    expect(
      await write(
        session,
        `insert into pgr (org_id, company_id, work_unit_id)
         values ('org_a','${I.companyA}','${I.workUnitA}')`,
      ),
    ).toBe(1);
  });

  it("lets only the office administrator grant or revoke, and never a member for itself", async () => {
    await grant({ user: X.scoped, company: I.companyA, area: "safety" });
    const selfGrant = `insert into member_access_scopes
      (org_id, user_id, company_id, area, granted_by)
      values ('org_a','${X.scoped}','${X.companyA2}','safety','${X.scoped}')`;
    await expect(write(office(X.scoped), selfGrant)).rejects.toThrow(
      /row-level security/,
    );
    await expect(write(office(X.legacy), selfGrant)).rejects.toThrow(
      /row-level security/,
    );
    expect(await write(office(X.scoped), `delete from member_access_scopes`)).toBe(0);
    expect(await ids(office(X.scoped), "companies")).toEqual([I.companyA]);

    const ownerGrant = `insert into member_access_scopes
      (org_id, user_id, company_id, area, granted_by)
      values ('org_a','${X.scoped}','${X.companyA2}','safety','${X.owner}')`;
    expect(await write(office(X.owner), ownerGrant)).toBe(1);
    await expect(
      write(
        office(X.owner),
        `insert into member_access_scopes (org_id, user_id, company_id, area, granted_by)
         values ('org_a','${X.healthOnly}','${I.companyA}','health','someone-else')`,
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      await write(
        office(X.owner),
        `delete from member_access_scopes where company_id = '${X.companyA2}'`,
      ),
    ).toBe(1);
    await expect(
      write(office(X.owner), `update member_access_scopes set area = 'health'`),
    ).rejects.toThrow(/permission denied/);
  });

  it("shows a member only its own scope rows", async () => {
    await grant({ user: X.scoped, company: I.companyA, area: "safety" });
    await grant({ user: X.healthOnly, company: I.companyA, area: "health" });
    expect(await ids(office(X.scoped), "member_access_scopes")).toHaveLength(1);
    expect(await ids(office(X.legacy), "member_access_scopes")).toEqual([]);
    expect(await ids(office(X.owner), "member_access_scopes")).toHaveLength(2);
  });

  it("rejects duplicated, cross-company and unknown-area grants", async () => {
    await grant({ user: X.scoped, company: I.companyA, area: "safety" });
    await expect(
      grant({ user: X.scoped, company: I.companyA, area: "safety" }),
    ).rejects.toThrow(/uq_member_access_scopes/);
    await expect(
      grant({
        user: X.scoped,
        company: X.companyA2,
        workUnit: I.workUnitA,
        area: "safety",
      }),
    ).rejects.toThrow(/foreign key/);
    await expect(
      grant({ user: X.scoped, company: I.companyA, area: "pgr" }),
    ).rejects.toThrow(/member_access_scopes_area_check/);
    await expect(
      grant({ user: "not-a-member", company: I.companyA, area: "safety" }),
    ).rejects.toThrow(/foreign key/);
  });

  it("drops the scopes with the membership, the company or the work unit", async () => {
    await grant({
      user: X.scoped,
      company: I.companyA,
      workUnit: X.workUnitA_2,
      area: "safety",
    });
    await grant({ user: X.scoped, company: X.companyA2, area: "safety" });
    await grant({ user: X.healthOnly, company: I.companyA, area: "health" });
    await admin`delete from work_units where id = ${X.workUnitA_2}`;
    await admin`delete from companies where id = ${X.companyA2}`;
    await admin`delete from org_memberships where user_id = ${X.healthOnly}`;
    expect(await admin`select id from member_access_scopes`).toHaveLength(0);
  });

  it("binds every table that carries a company or work unit to the access scope", async () => {
    const policies = await admin<ScopePolicy[]>`
      select tablename::text, qual from pg_policies
      where schemaname = 'public' and permissive = 'RESTRICTIVE'
        and cmd in ('ALL', 'SELECT') and 'app_runtime' = any(roles) and qual is not null`;
    const carriers = await admin<{ table_name: string }[]>`
      select distinct c.table_name::text
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
        and t.table_type = 'BASE TABLE'
      where c.table_schema = 'public' and c.column_name in ('company_id', 'work_unit_id')
      order by 1`;
    const bound = scopeBoundTables(policies);
    expect(carriers.length).toBeGreaterThan(30);
    expect(
      carriers.map((row) => row.table_name).filter((table) => !bound.has(table)),
    ).toEqual([]);
  });
});
