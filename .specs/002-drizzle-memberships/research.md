# Phase 0 — Research

**Feature**: Drizzle ORM + `org_memberships`
**Date**: 2026-05-25

Resolve as decisões técnicas necessárias antes do design (Phase 1). Cada item segue o formato Decision / Rationale / Alternatives considered.

---

## R1. Driver Postgres para Drizzle contra o pooler do Supabase

**Decision**: Usar `postgres` (driver Porsager `postgres-js`), com `prepare: false` quando conectado ao pooler em transaction mode, mais `idle_timeout: 20` e `max: 1` em ambiente serverless.

**Rationale**:

- `postgres-js` é o driver oficialmente sugerido pela documentação Drizzle para Supabase quando a conexão é direta TCP. Suporta o protocolo binário, tem footprint pequeno e bom desempenho em cold start.
- Pooler do Supabase (Supavisor) em transaction mode reescreve cada query como uma transação independente; prepared statements compartilhados entre conexões não funcionam (cada query "vê" uma conexão Postgres diferente). Solução: `prepare: false` desativa o cache de prepared statements no lado do cliente. Drizzle continua tipando as queries normalmente; só o protocolo passa a usar query simples.
- `max: 1` evita acúmulo de conexões dentro de uma única invocação Lambda/Edge; o pool real fica do lado do Supavisor. `idle_timeout: 20s` garante que conexões zumbis sejam reciclar antes do Vercel encerrar a instância.

**Alternatives considered**:

- `@supabase/postgres-js`: na prática é um re-export thin de `postgres-js`. Sem benefício adicional; preferimos o pacote upstream.
- `pg` (node-postgres): mais pesado, sem benefício para esta carga. Drizzle suporta, mas não é a recomendação atual para serverless.
- `@vercel/postgres`: feito para Neon/Vercel Postgres, não para Supabase. Out.
- `postgres.js` (note: o mesmo pacote, apenas confirmação de naming).

**Implementation notes**: documentar em `lib/db/index.ts` por que `prepare: false`. Validar via Context7 (Drizzle docs + Supavisor docs) na implementação real, antes de fixar versão.

---

## R2. Estratégia de connection string (pooler vs. direta)

**Decision**: Duas variáveis de ambiente, com guarda explícita no código:

- `DATABASE_URL` → pooler Supavisor, **transaction mode**, porta `6543`, usuário `app_runtime`. Lida exclusivamente por `lib/db/index.ts`.
- `DATABASE_URL_UNPOOLED` → conexão direta, porta `5432`, usuário `postgres`. Lida exclusivamente por `drizzle.config.ts` (Drizzle Kit). NÃO importada em runtime; um lint/regex pode garantir que ninguém faça `process.env.DATABASE_URL_UNPOOLED` fora do `drizzle.config.ts` e `scripts/db-reset-dev.ts`.

**Rationale**:

- Pooler em transaction mode é obrigatório para serverless: cada lambda dura ms; sem pool externo, o Postgres satura. Pooler em **session mode** preserva prepared statements mas não suporta milhares de conexões — não atende.
- Migrations criam funções, triggers, policies, roles e dependem de advisory locks (`drizzle-kit migrate` usa `pg_advisory_lock` para serializar runners). Esses recursos não funcionam confiavelmente sob pooler transaction mode. Conexão direta é a única opção segura para migrations.
- Reset do dev (`db-reset-dev.ts`) também usa `DATABASE_URL_UNPOOLED` porque executa DDL.

**Alternatives considered**:

- Pooler em session mode em runtime: não escala para serverless; rejeitado.
- Uma única URL com `?pgbouncer=true` mais reuso de cliente entre invocações: o Vercel não garante reuso; abordagem frágil.

---

## R3. Papel Postgres restrito do runtime (`app_runtime`)

**Decision**: Criar o papel `app_runtime` via DDL na primeira migration Drizzle (mesmo arquivo que cria as tabelas):

```sql
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime login password :'app_runtime_password' nobypassrls noinherit;
  end if;
end$$;

grant usage on schema public to app_runtime;
grant select, insert, update, delete on public.users to app_runtime;
grant select, insert, update, delete on public.orgs to app_runtime;
grant select, insert, update, delete on public.org_memberships to app_runtime;
```

A senha vem de variável de ambiente `APP_RUNTIME_DB_PASSWORD`, injetada no momento da migration. Drizzle Kit suporta migrations SQL puras escritas à mão dentro de `lib/db/migrations/` — vamos materializar o trecho de papel/grants como bloco custom SQL anexado à migration gerada (ou como migration separada `0001_app_runtime_role.sql` aplicada logo após `0000_initial_schema.sql`).

**Rationale**:

- Princípio de menor privilégio: `app_runtime` só toca o schema `public`, sem `BYPASSRLS`. RLS continua sendo backstop real, não decorativo.
- Idempotente: `do $$ if not exists`. Rerunnable em qualquer ambiente.
- Code-first total: nenhum passo no Dashboard Supabase. `drizzle-kit migrate` em ambiente novo cria o papel; deploy passa a `DATABASE_URL` apontando para esse papel.
- A senha fora do repo. Em produção/staging, configurada como secret no Vercel/CI. Em dev, lida de `.env.local`.

**Alternatives considered**:

- Reutilizar `authenticated` (papel built-in do Supabase): usado pelo PostgREST/`supabase-js` com claims do JWT. Para Drizzle direto, não temos claims, então o RLS por `auth.jwt()` simplesmente não retorna nada — `auth.jwt()` é null. Inviável para a fatia atual (mesmo que apenas admin/sistema).
- `service_role`: tem `BYPASSRLS`. Viola Princípio I/V e FR-022 explicitamente.
- Papel criado manualmente no Dashboard: viola a decisão Q4 (code-first total).

**Implementation notes**: a função `auth.jwt()` no Supabase retorna null fora do contexto PostgREST. Para policies que usam `auth.jwt() ->> 'org_id'`, isso significa que Drizzle conectado como `app_runtime` **vê 0 linhas** em `org_memberships` na ausência de claims. Isso é intencional: nesta fatia o consumidor Drizzle é admin/sistema (webhook do Clerk usa `supabase-js` com `sb_secret_...` para escrever, não Drizzle). Documentado em `lib/db/index.ts`.

---

## R4. Como os handlers do webhook escrevem em `org_memberships`

**Decision**: Handlers do webhook continuam usando `getSupabaseAdminClient()` (com `sb_secret_...`) para os upserts/deletes, **não** o cliente Drizzle. Drizzle nesta fatia é o dono code-first do **schema**, mas a escrita do webhook usa o caminho já existente (admin client com `BYPASSRLS` por design — apenas o webhook tem essa credencial).

**Rationale**:

- O cliente admin já está testado, isolado em `lib/supabase/admin.ts` e guardado com `server-only`. Mudar o transporte sem motivo expande a superfície de mudança.
- Drizzle ainda agrega valor: schemas tipados podem ser usados para validar/derivar tipos das rows escritas via admin client (compartilhamento de tipos em `lib/db/schema/`).
- Consistência com a decisão Q1 (Drizzle escopo limitado): os mappers que constroem as rows ficam tipados pelos schemas Drizzle, mas a chamada de escrita usa o cliente admin do Supabase.

**Alternatives considered**:

- Escritas via Drizzle com um pool separado conectado como `postgres` (superuser): viola FR-022 (proibido usar superuser) — rejeitado.
- Escritas via Drizzle com `app_runtime`: `app_runtime` tem GRANT de INSERT/UPDATE/DELETE em `org_memberships`, mas RLS bloqueia escrita para `authenticated`. Mesmo sem o JWT, ele não está em `BYPASSRLS`, então políticas restritivas se aplicam. Daria pra criar uma policy "permite escrita se `current_user = 'app_runtime' AND has_some_marker'", mas isso fragmenta o modelo (duas formas de escrever). Não vale o custo nesta fatia. Anotado como possível evolução futura.

**Implementation notes**: o módulo `lib/db/repositories/` exporta funções como `upsertOrgMembership(input)` que retornam `Pick<...>` dos schemas Drizzle, mas internamente delegam à `getSupabaseAdminClient().from('org_memberships').upsert(...)`. Quando a transição completa pra Drizzle acontecer em fatia futura, basta trocar a implementação dessas funções sem mudar as call sites.

---

## R5. Estratégia de teste de integração para Drizzle/RLS

**Decision**: Usar um **branch Postgres efêmero do próprio Supabase** (`supabase db branch` ou um project de testes dedicado) com snapshot resetado a cada suite, em vez de `pglite`/SQLite. Os schemas/RLS/triggers da fatia dependem de funções `auth.jwt()` e `pg_roles` específicas do Supabase — `pglite` (Postgres WASM) suporta DDL básica mas não a stack `auth.*` do Supabase.

Para integração rápida (sem rede), criar um helper `tests/integration/_helpers/db.ts` que:

1. Lê `INTEGRATION_DATABASE_URL` do `.env.test.local` (sempre apontando para um branch/project de testes).
2. Executa todas as migrations Drizzle no início da suite.
3. Trunca todas as tabelas antes de cada teste (mais rápido que recriar).
4. Mocka `auth.jwt()` setando `request.jwt.claims` via `set_config('request.jwt.claims', '{...}', true)` por conexão de teste, simulando claims do Clerk.

> Nota: CLAUDE.md menciona "SQLite em memória" como padrão de integração. Esta fatia diverge porque o feature inteiro depende de comportamento Postgres-específico (RLS, triggers, papéis, `auth.jwt()`). Documentar esta exceção no plano e no `quickstart.md`; manter SQLite como padrão para outras fatias.

**Rationale**:

- Testar RLS contra SQLite seria teatro: RLS não existe em SQLite. Falhas críticas (vazamento entre orgs) passariam sem ser pegas.
- Branch efêmero do Supabase preserva paridade 1:1 com produção. Custo: requer credencial `INTEGRATION_DATABASE_URL` em CI.
- A divergência do padrão (CLAUDE.md) está documentada e justificada pela natureza da fatia. Outras fatias continuam com SQLite.

**Alternatives considered**:

- `pglite`: leve, em memória, mas sem `auth.*` schema do Supabase. Poderíamos stubar `auth.jwt()` via função SQL local, mas reproduzir o comportamento de `BYPASSRLS` e papéis ainda é frágil.
- Docker Postgres local em CI: viável, mas adiciona dependência de container ao pipeline. Branch do Supabase é gerenciado.
- SQLite (padrão CLAUDE.md): rejeitado pela razão acima. Documentar exceção.

**Implementation notes**: para unitários puros (mappers payload→row, lógica de upsert sem DB), continuar com Jest + mocks — não há mudança no padrão.

---

## R6. Eventos Clerk: shape e ordem garantida

**Decision**: Assumir **ordem NÃO garantida** entre eventos `user.*`, `organization.*` e `organizationMembership.*`. Handlers de membership executam upsert defensivo de `users` e `orgs` (decidido em Q5). Validar shape do evento com Zod antes de tocar o DB (Princípio V).

Shape de `OrganizationMembershipJSON` relevante (a confirmar via Context7 / `@clerk/backend` types durante a implementação):

- `id` — string `orgmem_xxx`
- `role` — string (ex.: `org:admin`, `org:member`)
- `organization` — objeto com `id` (`org_xxx`), `name`, `slug`, `image_url`, `created_at`, `updated_at`
- `public_user_data` — objeto com `user_id` (`user_xxx`), `first_name`, `last_name`, `image_url`, `identifier` (email)
- `created_at`, `updated_at`

**Rationale**:

- Clerk documenta entrega "at-least-once" com possíveis reentregas e ordem não estrita; isso é padrão de webhook em geral.
- Upsert defensivo + dados mínimos do payload garante convergência sem fila.
- Schema Zod por tipo de evento ajuda a TS strict + previne corrupção se o Clerk evoluir o shape.

**Alternatives considered**:

- Confiar na ordem: frágil, padrão da indústria diz "não confie".
- Mudar para entrega ordenada (alguma fila intermediária): viola Princípio II (sem nova infra).

**Implementation notes**: criar `lib/clerk/membership-event-mappers.ts` com 3 mappers puros (`toUserRow`, `toOrgRow`, `toOrgMembershipRow`), cada um tipado pelos schemas Drizzle correspondentes. Os mappers são unit-testáveis sem DB e isolam toda a lógica de conversão payload → row.

---

## R7. `set_updated_at` trigger — manter ou substituir por `$onUpdate`?

**Decision**: Manter a função/trigger SQL `set_updated_at` (definida na DDL atual em `supabase/migrations/0001_clerk_sync_init.sql`), portada para Drizzle como SQL custom dentro da primeira migration. NÃO substituir por `.$onUpdate(() => new Date())` do Drizzle.

**Rationale**:

- Triggers SQL atualizam `updated_at` **independentemente do caminho de escrita** (Drizzle, supabase-js, psql manual, futuras integrações). `$onUpdate` só funciona em writes via Drizzle.
- Múltiplos caminhos de escrita coexistem (decisão R4: webhook escreve via supabase-js admin). Trigger SQL é a única forma de garantir comportamento uniforme.
- Custo: ~5 linhas de SQL puro em uma migration; baixíssimo.

**Alternatives considered**:

- `.$onUpdate`: rejeitado por incompletude (não cobre escritas via admin client).
- Coluna `updated_at` mantida pela aplicação manualmente: fácil de esquecer; viola Princípio V (Postgres é fonte de verdade).

---

## R8. RLS policies via Drizzle — formato

**Decision**: Declarar RLS via blocos `sql` raw dentro do schema Drizzle, usando o helper `pgPolicy` quando disponível na versão atual do `drizzle-orm`. Se a versão fixada não tiver suporte completo a `pgPolicy`, usar `sql` template em uma migration custom SQL.

```ts
// lib/db/schema/org-memberships.ts (esboço)
import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  index,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const orgMemberships = pgTable(
  "org_memberships",
  {
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.orgId, t.userId] }),
    userIdx: index("org_memberships_user_idx").on(t.userId),
    selectOwnOrg: pgPolicy("org_memberships_select_own_org", {
      for: "select",
      to: "authenticated",
      using: sql`org_id = (auth.jwt() ->> 'org_id')`,
    }),
    // sem policies de insert/update/delete para `authenticated` → bloqueio implícito
  }),
);
```

**Rationale**:

- `pgPolicy` mantém a policy no mesmo lugar que a tabela (DX). Drizzle Kit gera a DDL correspondente.
- Para policies/triggers/roles/funções que `pgPolicy` ainda não cobre 100%, usar SQL custom em migration anexa (`lib/db/migrations/0001_*_sql.sql`), totalmente versionado.

**Alternatives considered**:

- 100% SQL puro escrito à mão (sem `pgPolicy`): perde-se o vínculo declarativo schema↔policy; rejeitado se a versão suportar.
- Definir policies via `supabase` CLI (`supabase/policies/`): contraria a decisão Q2 (Drizzle dono único).

**Implementation notes**: confirmar via Context7 (Drizzle Kit changelog) qual versão estável suporta `pgPolicy` + RLS enable/disable. Se houver bug conhecido, usar SQL custom; documentar a escolha em `lib/db/schema/README.md` ou comentário inline.

---

## Resumo de itens a verificar com Context7 durante a implementação

(Não bloqueia o plano; checagens leves no momento de codar para evitar drift vs. conhecimento interno.)

1. Versão fixada de `drizzle-orm` e `drizzle-kit` mais recente estável — confirmar suporte a `pgPolicy`, RLS, `pgRole` e migrations SQL custom.
2. Recomendação atual da Supabase Docs para `postgres-js` com Supavisor transaction mode (`prepare: false` etc.).
3. Shape final dos tipos `OrganizationMembershipJSON` em `@clerk/backend` da versão fixada do `@clerk/nextjs`.
4. Best practice atual para `pg_advisory_lock` em runners de migration Drizzle sob conexão direta.

Todos os "NEEDS CLARIFICATION" da spec/plan foram resolvidos. Phase 0 concluída.
