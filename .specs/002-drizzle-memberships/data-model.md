# Phase 1 — Data Model

**Feature**: Drizzle ORM + `org_memberships`
**Date**: 2026-05-25

Define entidades, colunas, relações, índices, RLS e triggers da fatia. Drizzle é o dono code-first; as DDLs equivalentes são geradas em `lib/db/migrations/0000_initial_schema.sql`.

---

## Entidades

### `public.users`

Espelha `lib/db/schema/users.ts`. Autoritativo a partir desta fatia (substitui `supabase/migrations/0001_clerk_sync_init.sql`).

| Coluna       | Tipo          | Constraints              | Origem                   |
| ------------ | ------------- | ------------------------ | ------------------------ |
| `id`         | `text`        | `PRIMARY KEY`            | Clerk `user_xxx`         |
| `email`      | `text`        | nullable                 | Clerk                    |
| `first_name` | `text`        | nullable                 | Clerk                    |
| `last_name`  | `text`        | nullable                 | Clerk                    |
| `image_url`  | `text`        | nullable                 | Clerk                    |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | trigger / app            |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | trigger `set_updated_at` |

**Trigger**: `BEFORE UPDATE` → `public.set_updated_at()` (compartilhada com `orgs` e `org_memberships`).

**RLS**: ON. Policy `users_select_self` — `SELECT` para `authenticated` quando `id = auth.jwt() ->> 'sub'`. Sem policies de INSERT/UPDATE/DELETE para `authenticated` (escritas só pelo webhook via admin client).

---

### `public.orgs`

Espelha `lib/db/schema/orgs.ts`.

| Coluna       | Tipo          | Constraints              | Origem                   |
| ------------ | ------------- | ------------------------ | ------------------------ |
| `id`         | `text`        | `PRIMARY KEY`            | Clerk `org_xxx`          |
| `name`       | `text`        | nullable                 | Clerk                    |
| `slug`       | `text`        | nullable, UNIQUE         | Clerk                    |
| `image_url`  | `text`        | nullable                 | Clerk                    |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | trigger / app            |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | trigger `set_updated_at` |

**Trigger**: `BEFORE UPDATE` → `public.set_updated_at()`.

**RLS**: ON. Policy `orgs_select_active_org` — `SELECT` para `authenticated` quando `id = auth.jwt() ->> 'org_id'`. Sem policies de escrita.

---

### `public.org_memberships` (NOVA)

Espelha `lib/db/schema/org-memberships.ts`. Relacionamento user ↔ org com role.

| Coluna       | Tipo          | Constraints                                                                     | Origem                   |
| ------------ | ------------- | ------------------------------------------------------------------------------- | ------------------------ |
| `org_id`     | `text`        | `NOT NULL`, FK → `public.orgs(id)` `ON DELETE CASCADE`                          | Clerk evento             |
| `user_id`    | `text`        | `NOT NULL`, FK → `public.users(id)` `ON DELETE CASCADE`                         | Clerk evento             |
| `role`       | `text`        | `NOT NULL` (valores em uso: `org:admin`, `org:member`; texto livre nesta fatia) | Clerk evento             |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()`                                                        | trigger / app            |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()`                                                        | trigger `set_updated_at` |

**Chave primária**: composta `(org_id, user_id)`. Garante unicidade por par e cobre upsert idempotente.

**Índices**:

- PK composta `(org_id, user_id)` — implícito, cobre lookup por org.
- `org_memberships_user_idx` em `(user_id)` — cobre "todas as orgs deste user".

**Trigger**: `BEFORE UPDATE` → `public.set_updated_at()`.

**RLS**: ON.

- Policy `org_memberships_select_active_org`:
  - `FOR SELECT TO authenticated`
  - `USING (org_id = (auth.jwt() ->> 'org_id'))`
- Sem policies de INSERT/UPDATE/DELETE para `authenticated` → bloqueio implícito.
- Escritas exclusivas via admin client (`sb_secret_...`) que bypassa RLS.

---

## Função e trigger compartilhada

```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

-- Aplicada a users, orgs, org_memberships via BEFORE UPDATE.
```

Idêntica à versão hoje em `supabase/migrations/0001_clerk_sync_init.sql`. Portada para a primeira migration Drizzle.

---

## Papel restrito do runtime

```sql
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    execute format('create role app_runtime login password %L nobypassrls noinherit', current_setting('app.app_runtime_password'));
  end if;
end$$;

grant usage on schema public to app_runtime;
grant select, insert, update, delete on public.users to app_runtime;
grant select, insert, update, delete on public.orgs to app_runtime;
grant select, insert, update, delete on public.org_memberships to app_runtime;
```

A senha é passada via `SET app.app_runtime_password = '<env>'` na sessão da migration (via wrapper em `scripts/db-migrate.ts` ou flag do `drizzle-kit`). Detalhe operacional em `quickstart.md`.

---

## Diagrama relacional

```
+-------------+       +-------------------+       +----------+
|   users     |<------| org_memberships   |------>|   orgs   |
|-------------|  N:1  |-------------------|  N:1  |----------|
| id (PK)     |       | user_id (FK)      |       | id (PK)  |
| email       |       | org_id  (FK)      |       | name     |
| first_name  |       | role              |       | slug     |
| last_name   |       | created_at        |       | image_url|
| image_url   |       | updated_at        |       | created_at|
| ...         |       | PK (org_id,       |       | updated_at|
| ...         |       |     user_id)      |       |          |
+-------------+       +-------------------+       +----------+
       ^                       ^
       |                       |
       | RLS: SELECT           | RLS: SELECT
       | when id = jwt.sub     | when org_id = jwt.org_id
       |                       |
       +-- writes:             +-- writes:
           webhook → admin         webhook → admin
           client (BYPASSRLS)      client (BYPASSRLS)
```

---

## Estado / transições

Não há máquina de estado complexa. Lifecycle de `org_memberships`:

```
[ausente] ── organizationMembership.created ──> [linha presente, role inicial]
[presente] ── organizationMembership.updated ──> [role atualizado, updated_at avança]
[presente] ── organizationMembership.deleted ──> [ausente]
[presente] ── orgs.id removida (cascade)     ──> [ausente]
[presente] ── users.id removida (cascade)    ──> [ausente]
```

Idempotência: qualquer transição executada N vezes converge ao mesmo estado final.

---

## Volumes esperados

- `users`: até centenas inicialmente, crescimento linear lento.
- `orgs`: dezenas inicialmente.
- `org_memberships`: ~N orgs × M membros médios. Dezenas a centenas inicialmente. Índices cobrem ambos os padrões de leitura.

---

## Validação de payload (Zod) — referência

Não faz parte do schema Drizzle, mas necessário no webhook por Princípio V. Definido em `lib/clerk/membership-event-mappers.ts`:

```ts
const OrganizationMembershipPayload = z.object({
  id: z.string(),
  role: z.string(),
  organization: z.object({
    id: z.string(),
    name: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    image_url: z.string().nullable().optional(),
  }),
  public_user_data: z.object({
    user_id: z.string(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    image_url: z.string().nullable().optional(),
    identifier: z.string().nullable().optional(), // email
  }),
});
```

Falha de validação → 400 do webhook, evento ignorado, sem tocar o DB. Log estruturado para investigação.
