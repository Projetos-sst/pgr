# Quickstart — Drizzle ORM + `org_memberships`

**Audience**: dev configurando o ambiente desta fatia pela primeira vez, e operador executando o rollout.

---

## 1. Pré-requisitos

- Node 20+, `npm`.
- Acesso ao projeto Supabase de dev (dashboard + senha do `postgres`).
- `.env.local` com chaves já existentes (Clerk + Supabase). Adicionar:

```dotenv
# Pooler (Supavisor, transaction mode) — usuário = app_runtime
DATABASE_URL="postgresql://app_runtime:<APP_RUNTIME_DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Conexão direta — usuário = postgres, USO EXCLUSIVO de drizzle-kit
DATABASE_URL_UNPOOLED="postgresql://postgres:<POSTGRES_PASSWORD>@db.<project-ref>.supabase.co:5432/postgres"

# Senha do papel restrito, lida pela migration que cria o role
APP_RUNTIME_DB_PASSWORD="<gerar string forte>"
```

> A senha do `postgres` vem do Dashboard Supabase → Project Settings → Database.
> A senha `APP_RUNTIME_DB_PASSWORD` é gerada agora e usada para sempre como password do papel restrito.

---

## 2. Instalar dependências

```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

> Versões fixas via Context7 no momento da implementação (R8 em research.md).

---

## 3. Reset do banco de dev (drop limpo)

Como a tabela `users` e `orgs` existem mas estão vazias (decisão Q3), faça reset antes da primeira migration:

```bash
npx tsx scripts/db-reset-dev.ts
```

Esse script:

1. Conecta com `DATABASE_URL_UNPOOLED` (papel `postgres`).
2. `DROP TABLE IF EXISTS public.org_memberships CASCADE;`
3. `DROP TABLE IF EXISTS public.orgs CASCADE;`
4. `DROP TABLE IF EXISTS public.users CASCADE;`
5. `DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;`
6. `DROP ROLE IF EXISTS app_runtime;`
7. Imprime `OK`.

**Não roda em produção** — guarda explícita por env (`if (process.env.NODE_ENV === 'production') throw`).

---

## 4. Aplicar migrations Drizzle

```bash
npm run db:migrate
```

Esperado: cria `users`, `orgs`, `org_memberships`, função `set_updated_at` + triggers, papel `app_runtime` com `GRANT`s, policies RLS. Sem erro.

Para verificar:

```bash
# smoke test
npx tsx -e "import {db} from './lib/db';(async()=>{const r=await db.execute('select 1 as ok, current_user as who');console.log(r);process.exit(0)})()"
```

Esperado:

```
[{ ok: 1, who: 'app_runtime' }]
```

Se `who` for `postgres` ou outro: bug — DATABASE_URL aponta pro user errado.

---

## 5. Remover `supabase/migrations/`

Concluído o passo anterior com sucesso, `supabase/migrations/` deixa de ser fonte de verdade:

```bash
rm -rf supabase/migrations
# Se a pasta supabase/ ficar vazia, remova-a também.
```

Commitar a remoção junto com as novas migrations Drizzle.

---

## 6. Habilitar eventos `organizationMembership.*` no Clerk

Dashboard Clerk → Webhooks → endpoint que aponta para `/api/webhooks/clerk` → editar **Subscribed events**:

- `organizationMembership.created`
- `organizationMembership.updated`
- `organizationMembership.deleted`

Salvar. Eventos passam a ser entregues. **Importante**: deixe a aplicação deployada antes de habilitar, ou rode o backfill (passo 7) imediatamente para popular o estado atual.

---

## 7. Rodar o backfill

```bash
npx tsx scripts/backfill-memberships.ts
```

Pode (e deve) ser executado tanto **antes** quanto **depois** de habilitar os eventos do Clerk — a idempotência cobre os dois caminhos. Saída esperada:

```
{ orgs_processed: 3, memberships_processed: 8, errors: 0 }
```

Rodar uma segunda vez deve produzir o mesmo resultado (zero novas linhas; `updated_at` pode avançar).

---

## 8. Quality gates

```bash
npm run lint
npm run typecheck
npm run test
npm run test:integration
```

Todos exit 0.

---

## Scripts NPM novos (`package.json`)

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/db-migrate.ts",
    "db:studio": "drizzle-kit studio"
  }
}
```

> `db:migrate` envolve `drizzle-kit migrate` em um wrapper que:
>
> 1. Lê `DATABASE_URL_UNPOOLED` e `APP_RUNTIME_DB_PASSWORD`.
> 2. Antes de rodar, executa `set app.app_runtime_password = '<env>'` no banco para que o DDL `do $$ create role` possa usar a senha via `current_setting('app.app_runtime_password')`.
> 3. Chama o runner do Drizzle Kit programaticamente.

---

## Troubleshooting

| Sintoma                                              | Causa provável                                                              | Fix                                                               |
| ---------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `db:migrate` falha com "advisory lock not supported" | `DATABASE_URL_UNPOOLED` está apontando pro pooler (porta 6543)              | Trocar para porta 5432, host `db.<ref>.supabase.co`               |
| Smoke test retorna `current_user = 'postgres'`       | `DATABASE_URL` está com user `postgres` em vez de `app_runtime`             | Editar `.env.local`                                               |
| Erro de FK `org_memberships_org_id_fkey` no webhook  | Org não existia e o upsert defensivo de `orgs` não rodou                    | Verificar mapper em `lib/clerk/membership-event-mappers.ts`       |
| Bundle do browser inclui `postgres-js`               | Algum arquivo `'use client'` ou `app/page.tsx` importando algo de `lib/db/` | Conferir `import 'server-only'` no topo e remover import indevido |
| RLS retorna 0 linhas em query de teste               | `auth.jwt()` é `null` (esperado para Drizzle direto sem claims)             | Esperado nesta fatia; queries por-usuário ficam em `supabase-js`  |
