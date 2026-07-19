import postgres from "postgres";

import { adminClient, applyMigrations, truncateAll } from "../_helpers/db";

// Perfil (#84) + admin global (#89): a tabela `users` guarda os campos de perfil
// app-managed (phone/cpf/job_title — preservados entre upserts do Clerk) e a flag
// global `is_master` (gate de superadmin, NÃO papel de tenant). Esta suíte cobre o
// backstop de banco: default de is_master, round-trip dos campos de perfil e a
// política RLS de identidade (users_select_self). Os repos dessas features usam o
// service client (PostgREST, bypassa RLS) — por isso a leitura administrativa
// enxerga todas as linhas; o RLS aqui é o backstop para a rota autenticada.
const shouldRun = !!process.env.INTEGRATION_DATABASE_URL;

(shouldRun ? describe : describe.skip)("users — perfil + is_master (#84/#89)", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });

  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await truncateAll(admin);
  });

  it("is_master default false; campos de perfil default null", async () => {
    const [row] = await admin<
      {
        is_master: boolean;
        phone: string | null;
        cpf: string | null;
        job_title: string | null;
      }[]
    >`
      insert into public.users (id, email) values ('u1','u1@example.com')
      returning is_master, phone, cpf, job_title`;
    expect(row.is_master).toBe(false);
    expect(row.phone).toBeNull();
    expect(row.cpf).toBeNull();
    expect(row.job_title).toBeNull();
  });

  it("round-trip do perfil app-managed (updateUserProfile) preserva phone/cpf/job_title", async () => {
    await admin`insert into public.users (id, email) values ('u1','u1@example.com')`;
    await admin`
      update public.users
      set phone = '11999998888', cpf = '39053344705', job_title = 'QA Tester'
      where id = 'u1'`;
    const [row] = await admin<
      { phone: string | null; cpf: string | null; job_title: string | null }[]
    >`select phone, cpf, job_title from public.users where id = 'u1'`;
    expect(row).toEqual({
      phone: "11999998888",
      cpf: "39053344705",
      job_title: "QA Tester",
    });
  });

  it("promover/rebaixar master é uma flag booleana no próprio usuário", async () => {
    await admin`insert into public.users (id, email, is_master) values ('m1','m1@x.com', true)`;
    const [before] = await admin<{ is_master: boolean }[]>`
      select is_master from public.users where id = 'm1'`;
    expect(before.is_master).toBe(true);
    await admin`update public.users set is_master = false where id = 'm1'`;
    const [after] = await admin<{ is_master: boolean }[]>`
      select is_master from public.users where id = 'm1'`;
    expect(after.is_master).toBe(false);
  });

  it("RLS: política users_select_self existe (id = auth.jwt()->>'sub')", async () => {
    const [policy] = await admin<{ qual: string }[]>`
      select pg_get_expr(polqual, polrelid) as qual
      from pg_policy where polname = 'users_select_self'`;
    expect(policy).toBeDefined();
    expect(policy.qual).toContain("sub");
  });
});
