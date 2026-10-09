import postgres from "postgres";

import { adminClient, applyMigrations } from "../_helpers/db";

/**
 * O contrato de segurança da tabela de pré-cadastro, verificado contra Postgres
 * de verdade — não contra a intenção do schema.
 *
 * O que precisa valer:
 * - o papel de runtime (`app_runtime`), que é quem atende a rota pública,
 *   consegue **gravar** um pedido de orçamento;
 * - o mesmo papel **não consegue ler** nada da tabela: não existe consulta
 *   pública de leads, nem do próprio registro recém-criado;
 * - o mesmo e-mail não grava dois pedidos no mesmo dia (índice único).
 */
const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

/**
 * Cliente conectado de fato COMO `app_runtime`.
 *
 * Não usamos o `appRuntimeClient()` do helper: apesar do nome, ele abre a
 * conexão com `INTEGRATION_DATABASE_URL` (a de administração). As outras suítes
 * não notam porque exercitam o papel de runtime indiretamente, injetando a URL
 * no `getDatabaseUrl` da aplicação. Aqui o papel é o próprio objeto do teste —
 * usar o helper faria a asserção de "não consegue ler" passar por engano, com o
 * superusuário no lugar do papel restrito.
 */
const runtimeClient = () =>
  postgres(APP_RUNTIME_URL as string, { max: 1, prepare: false });

const lead = {
  name: "Ana Souza",
  company: "Consultoria SST Ltda",
  email: "ana.souza@exemplo.com.br",
  phone: "(11) 98888-7777",
  interest: "both",
  message: "Atendemos 12 empresas.",
  source: "quote",
};

(shouldRun ? describe : describe.skip)("platform_leads — pré-cadastro público", () => {
  let admin: ReturnType<typeof adminClient>;
  let runtime: ReturnType<typeof runtimeClient>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    runtime = runtimeClient();
  });

  afterAll(async () => {
    // Opcional: se o `beforeAll` falhar, as conexões não chegam a existir e um
    // `.end()` direto mascararia o erro real com um TypeError.
    await runtime?.end({ timeout: 5 });
    await admin?.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await admin.unsafe("truncate table public.platform_leads;");
  });

  it("o papel de runtime grava o pedido sem contexto de tenant", async () => {
    await expect(
      runtime`
        insert into public.platform_leads (name, company, email, phone, interest, message, source)
        values (${lead.name}, ${lead.company}, ${lead.email}, ${lead.phone},
                ${lead.interest}::lead_interest, ${lead.message}, ${lead.source}::lead_source)
      `,
    ).resolves.toBeDefined();

    // Conferência pela conexão administrativa — a de runtime não enxerga nada.
    const rows =
      await admin`select name, email, interest, source from public.platform_leads`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: lead.name,
      email: lead.email,
      interest: "both",
      source: "quote",
    });
  });

  it("o papel de runtime NÃO consegue ler a tabela — sem GRANT de SELECT", async () => {
    await admin`
      insert into public.platform_leads (name, company, email, phone, interest)
      values ('Outro', 'Outra Empresa', 'outro@exemplo.com', '11999998888', 'safety')
    `;

    await expect(runtime`select * from public.platform_leads`).rejects.toThrow(
      /permission denied/i,
    );
    await expect(runtime`select count(*) from public.platform_leads`).rejects.toThrow(
      /permission denied/i,
    );
  });

  it("o papel de runtime NÃO consegue alterar nem apagar pedidos", async () => {
    await admin`
      insert into public.platform_leads (name, company, email, phone, interest)
      values ('Outro', 'Outra Empresa', 'outro@exemplo.com', '11999998888', 'safety')
    `;

    await expect(
      runtime`update public.platform_leads set name = 'hackeado'`,
    ).rejects.toThrow(/permission denied/i);
    await expect(runtime`delete from public.platform_leads`).rejects.toThrow(
      /permission denied/i,
    );
  });

  it("o INSERT não pode devolver colunas — `returning` esbarra na falta de SELECT", async () => {
    await expect(
      runtime`
        insert into public.platform_leads (name, company, email, phone, interest)
        values (${lead.name}, ${lead.company}, ${lead.email}, ${lead.phone}, 'both')
        returning id
      `,
    ).rejects.toThrow(/permission denied/i);
  });

  it("o mesmo e-mail não grava dois pedidos no mesmo dia", async () => {
    const insert = () => runtime`
      insert into public.platform_leads (name, company, email, phone, interest)
      values (${lead.name}, ${lead.company}, ${lead.email}, ${lead.phone}, 'both')
    `;

    await insert();
    await expect(insert()).rejects.toMatchObject({ code: "23505" });

    const rows = await admin`select count(*)::int as total from public.platform_leads`;
    expect(rows[0].total).toBe(1);
  });

  it("a deduplicação ignora a caixa do e-mail", async () => {
    await runtime`
      insert into public.platform_leads (name, company, email, phone, interest)
      values ('Ana', 'ACME', 'ana@exemplo.com', '11988887777', 'safety')
    `;
    await expect(
      runtime`
        insert into public.platform_leads (name, company, email, phone, interest)
        values ('Ana', 'ACME', 'ANA@Exemplo.com', '11988887777', 'safety')
      `,
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("e-mails diferentes convivem no mesmo dia", async () => {
    for (const email of ["a@exemplo.com", "b@exemplo.com", "c@exemplo.com"]) {
      await runtime`
        insert into public.platform_leads (name, company, email, phone, interest)
        values ('Pessoa', 'Empresa', ${email}, '11988887777', 'health')
      `;
    }
    const rows = await admin`select count(*)::int as total from public.platform_leads`;
    expect(rows[0].total).toBe(3);
  });

  it("a tabela está com RLS habilitado e sem policy de leitura", async () => {
    const [table] = await admin`
      select relrowsecurity from pg_class where oid = 'public.platform_leads'::regclass
    `;
    expect(table.relrowsecurity).toBe(true);

    const policies = await admin`
      select polname, polcmd from pg_policy where polrelid = 'public.platform_leads'::regclass
    `;
    expect(policies).toHaveLength(1);
    // 'a' = INSERT no catálogo do Postgres; nenhuma policy de SELECT existe.
    expect(policies[0]).toMatchObject({
      polname: "platform_leads_public_insert",
      polcmd: "a",
    });
  });

  it("a tabela é global: não tem coluna org_id", async () => {
    const columns = await admin`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'platform_leads'
    `;
    const names = columns.map((c) => c.column_name);
    expect(names).not.toContain("org_id");
    expect(names).toEqual(
      expect.arrayContaining([
        "id",
        "name",
        "company",
        "email",
        "phone",
        "interest",
        "message",
        "source",
        "submitted_on",
        "created_at",
      ]),
    );
  });
});
