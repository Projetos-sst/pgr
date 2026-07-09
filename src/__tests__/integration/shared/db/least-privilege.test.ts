import postgres from "postgres";

import {
  adminClient,
  applyMigrations,
  setJwtClaims,
  truncateAll,
} from "../../_helpers/db";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

(shouldRun ? describe : describe.skip)("US4 — least privilege & RLS", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;

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
    await truncateAll(admin);
  });

  it("connects as app_runtime without BYPASSRLS", async () => {
    const rows = await runtime<{ current_user: string }[]>`select current_user`;
    expect(rows[0].current_user).toBe("app_runtime");

    const roleRows = await admin<{ rolname: string; rolbypassrls: boolean }[]>`
      select rolname, rolbypassrls from pg_roles where rolname = 'app_runtime'
    `;
    expect(roleRows[0].rolbypassrls).toBe(false);
  });

  // Modelo pós-0006 (Data API fechada): org_memberships não tem policy para
  // app_runtime — RLS default-deny. INSERT quebra no WITH CHECK; UPDATE/DELETE
  // não enxergam linha alguma (0 afetadas) e o dado permanece intacto; a leitura
  // de memberships é exclusiva do provisionamento (service_role/PostgREST).
  it("blocks INSERT and hides rows from UPDATE/DELETE on org_memberships (RLS default-deny)", async () => {
    await admin.unsafe(`insert into public.users (id) values ('user_x')`);
    await admin.unsafe(`insert into public.orgs (id) values ('org_x')`);
    await admin.unsafe(
      `insert into public.org_memberships (org_id, user_id, role) values ('org_x','user_x','org:member')`,
    );

    await expect(
      runtime`insert into public.org_memberships (org_id, user_id, role) values ('org_x','user_x','org:admin')`,
    ).rejects.toThrow();

    const updated =
      await runtime`update public.org_memberships set role = 'org:admin' where org_id = 'org_x' and user_id = 'user_x'`;
    expect(updated.count).toBe(0);
    const deleted =
      await runtime`delete from public.org_memberships where org_id = 'org_x' and user_id = 'user_x'`;
    expect(deleted.count).toBe(0);

    const intact = await admin<{ role: string }[]>`
      select role from public.org_memberships where org_id = 'org_x' and user_id = 'user_x'
    `;
    expect(intact).toHaveLength(1);
    expect(intact[0].role).toBe("org:member");
  });

  it("SELECT em org_memberships por app_runtime → 0 linhas, com ou sem claim", async () => {
    await admin.unsafe(`insert into public.users (id) values ('user_a'),('user_b')`);
    await admin.unsafe(`insert into public.orgs (id) values ('org_a'),('org_b')`);
    await admin.unsafe(`
      insert into public.org_memberships (org_id, user_id, role) values
        ('org_a','user_a','org:member'),
        ('org_b','user_b','org:member')
    `);

    // A policy remanescente é TO authenticated (Data API, fechada na 0006) e não
    // alcança o app_runtime — mesmo com claim de org o backstop nega tudo.
    await setJwtClaims(runtime, { org_id: "org_a" });
    const rowsA = await runtime`select org_id from public.org_memberships`;
    expect(rowsA).toHaveLength(0);

    await setJwtClaims(runtime, null);
    const rowsNone = await runtime`select org_id from public.org_memberships`;
    expect(rowsNone).toHaveLength(0);
  });
});
