# Feature futura: Drizzle ORM + `org_memberships`

Documento de contexto pra retomar esta feature depois. **Não é uma spec
formal** — quando for executar, gere `spec.md`, `plan.md`, `tasks.md` via
spec-kit a partir daqui.

## Por que existe

Na feature `001-clerk-auth` integramos Clerk ↔ Supabase com sincronização
via webhook (apenas `users` e `orgs`, dados básicos). Ficou de fora:

1. Adoção do **Drizzle ORM** (hoje o acesso ao Supabase é via `supabase-js`).
2. Tabela **`org_memberships`** (relação user ↔ org com `role`).

Foi deferido conscientemente pra manter o slice `001` enxuto.

## Estado atual ao iniciar esta feature

### Stack já em produção

- **Next.js 16.2.6** (App Router; middleware renomeado pra `proxy.ts`)
- **React 19.2.4**, **TypeScript strict**, **Tailwind v4** (CSS-first)
- **Clerk** (`@clerk/nextjs@^7.4.1`) com Organizations habilitadas
- **Supabase** com Third-Party Auth = Clerk (token Clerk usado direto, sem
  template JWT)
- **`@supabase/supabase-js@^2.106.x`** com as **novas API keys**
  (`sb_publishable_...` / `sb_secret_...` — as legadas `anon`/`service_role`
  estão deprecated)

### Arquivos relevantes

| Caminho | Função |
|---|---|
| `proxy.ts` | Middleware Clerk; rotas públicas incluem `/api/webhooks/(.*)` |
| `lib/auth/get-session.ts` | `getSessionOrNull()` |
| `lib/auth/require-auth.ts` | `requireAuth()` |
| `lib/auth/require-org-context.ts` | `requireOrgContext()` → `{ userId, orgId, orgRole, ... }` |
| `lib/supabase/env.ts` | Valida prefixo `sb_publishable_` |
| `lib/supabase/server.ts` | `createSupabaseServerClient()` — token via `auth().getToken()`, per-request |
| `lib/supabase/browser.ts` | Hook `useSupabaseBrowserClient()` — token via `useSession().getToken()` |
| `lib/supabase/admin.ts` | `getSupabaseAdminClient()` — `sb_secret_...`, bypassa RLS, **server-only**, **uso exclusivo do webhook** |
| `app/api/webhooks/clerk/route.ts` | Webhook Clerk → Supabase (eventos `user.*` e `organization.*`) |
| `supabase/migrations/0001_clerk_sync_init.sql` | Tabelas `users` e `orgs` + RLS + trigger `updated_at` |

### Schema atual (`0001_clerk_sync_init.sql`)

```sql
public.users (
  id text PK,             -- Clerk user_xxx
  email, first_name, last_name, image_url,
  created_at, updated_at
)
public.orgs (
  id text PK,             -- Clerk org_xxx
  name, slug, image_url,
  created_at, updated_at
)
```

### Política RLS atual

- `users`: SELECT só do próprio (`id = auth.jwt() ->> 'sub'`)
- `orgs`: SELECT só da org ativa (`id = auth.jwt() ->> 'org_id'`)
- INSERT/UPDATE/DELETE: **sem policy** pra `authenticated` → só pelo
  webhook (`sb_secret_...` bypassa RLS).

### Claims do token Clerk disponíveis (com integração nativa)

- `sub` → Clerk userId
- `org_id` → org ativa
- `org_role` → role do user na org ativa (ex.: `org:admin`, `org:member`)
- `org_slug`
- `role` → `authenticated` (mapeado pelo Supabase)

### Eventos Clerk hoje tratados

`user.created`, `user.updated`, `user.deleted`,
`organization.created`, `organization.updated`, `organization.deleted`.

## Escopo desta feature futura

### 1) Tabela `org_memberships`

Esboço inicial (refinar na spec):

```sql
create table public.org_memberships (
  org_id   text references public.orgs(id)  on delete cascade,
  user_id  text references public.users(id) on delete cascade,
  role     text not null,                 -- "org:admin" | "org:member" | custom
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index org_memberships_user_idx on public.org_memberships (user_id);
```

**RLS sugerido**:

- SELECT: membros enxergam a lista da própria org ativa
  `org_id = auth.jwt() ->> 'org_id'`
- INSERT/UPDATE/DELETE: bloqueado pra `authenticated` (webhook owns it)

### 2) Eventos adicionais no webhook

`app/api/webhooks/clerk/route.ts` precisará tratar:

- `organizationMembership.created` → upsert
- `organizationMembership.updated` → upsert (mudança de role)
- `organizationMembership.deleted` → delete

Shape de `evt.data` para esses eventos (do tipo `OrganizationMembershipJSON`):
`id`, `role`, `organization.id`, `public_user_data.user_id`, timestamps.

**Marcar esses 3 eventos adicionais no Clerk Dashboard → Webhooks.**

### 3) Migrar acesso ao Supabase pra Drizzle

- Adicionar `drizzle-orm` + `drizzle-kit` + driver Postgres compatível
  (recomendado: `postgres` da Porsager via connection pooler do Supabase,
  ou `@supabase/postgres-js`).
- Definir schema em `db/schema.ts` espelhando `users`, `orgs`, `org_memberships`.
- Decidir **estratégia de conexão**:
  - Para queries autenticadas com RLS via Clerk → continuar com
    `supabase-js` (que injeta o token JWT) **ou** configurar conexão
    Postgres direto setando `request.jwt.claims` por sessão (mais complexo).
  - Para queries do webhook (admin) → conexão direta com `SUPABASE_SECRET_KEY`
    ou string de conexão Postgres com role `postgres`.
- Gerar migrações com `drizzle-kit` e padronizar pasta
  (`supabase/migrations/` continua como fonte autoritativa? ou migrar pra
  `drizzle/migrations/`? — decisão aberta).

### 4) Backfill

Antes de ativar os novos eventos:

- Script one-off (server-side com `clerkClient`) que pagina
  `organizations.getOrganizationMembershipList` pra cada org existente e
  popula `org_memberships`. Idempotente (upsert por PK composta).

## Decisões em aberto pra essa feature decidir

1. Drizzle gerencia migrations ou continuamos com SQL puro em
   `supabase/migrations/`?
2. Conexão Postgres direta (pgbouncer/pooler) coexistindo com `supabase-js`,
   ou substituição total?
3. `role` em `org_memberships` é `text` livre ou enum tipado?
4. Suportar **roles customizadas** do Clerk (além de `admin`/`member`)?
5. Soft-delete (`deleted_at`) ou hard-delete via `on delete cascade`?

## Princípios herdados (manter)

- Nunca usar chaves legadas (`anon`/`service_role`); só `sb_publishable_` /
  `sb_secret_`.
- `server-only` em qualquer módulo que toque `SUPABASE_SECRET_KEY`.
- Per-request client no servidor (token Clerk é per-request).
- RLS ON em toda tabela nova; writes via webhook por padrão.
- Testes: unitários (lógica) + integração com SQLite em memória (per
  `CLAUDE.md`).
