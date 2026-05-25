# Implementation Plan: Drizzle ORM + `org_memberships`

**Branch**: `feature/drizzle-orm-setup` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-drizzle-memberships/spec.md`

## Summary

Adotar Drizzle ORM como o **único dono code-first da estrutura do banco** (padrão EF Core / TypeORM), portando as DDLs hoje em `supabase/migrations/0001_clerk_sync_init.sql` para schemas Drizzle versionados em `lib/db/schema/` e migrations geradas em `lib/db/migrations/`. Adicionar a primeira tabela relacional (`org_memberships`, user ↔ org + role), sincronizá-la via webhook do Clerk com upsert defensivo (que também upserta `users`/`orgs` minimamente, tolerando qualquer ordem de entrega), e disponibilizar script de backfill idempotente. Cliente Drizzle conecta via pooler em transaction mode (porta 6543) usando um **papel Postgres restrito** (sujeito a RLS, criado pela própria migration), reservado nesta fatia a operações administrativas/sistema; dados por-usuário continuam via `@supabase/supabase-js` (que injeta o JWT do Clerk). Pasta `supabase/migrations/` é removida ao final.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js (runtime Vercel/Next.js 16.2.6), React 19.2.4

**Primary Dependencies**: `drizzle-orm@latest`, `drizzle-kit@latest` (dev), `postgres@latest` (driver Porsager `postgres-js`). Mantidas: `@clerk/nextjs@^7.4.1`, `@supabase/supabase-js@^2.106.x`, `zod@^4`, `next@16.2.6`.

**Storage**: Supabase Postgres. Duas connection strings: `DATABASE_URL` (pooler Supavisor, transaction mode, porta 6543, usuário = papel restrito `app_runtime`) para runtime serverless; `DATABASE_URL_UNPOOLED` (conexão direta, porta 5432, usuário = `postgres`) **exclusivamente** para `drizzle-kit` (migrations + studio).

**Testing**: Jest 30 (existente) com projects `unit` e `integration`. Unitários cobrem helpers puros de `lib/db/` e a lógica dos handlers de membership (com DB mockado). Integração roda contra um Postgres efêmero — ver Phase 0 para escolha entre `pglite` e Postgres real no Supabase de dev — exercitando as DDLs Drizzle e as policies RLS de ponta a ponta.

**Target Platform**: Vercel serverless (Node runtime para rotas que tocam Drizzle/Postgres — Edge runtime não suporta `postgres-js`).

**Project Type**: Aplicação web fullstack Next.js (App Router) — `app/`, `lib/`, `tests/` no monorepo único.

**Performance Goals**: Webhook handler MUST responder < 1s p95 sob carga normal (Clerk timeout = 30s, queremos folga); `select 1` smoke test < 100ms p95 via pooler.

**Constraints**:

- Cliente Drizzle MUST ser `server-only`; nenhum byte de Drizzle/driver/connection string no bundle do browser.
- Migrations MUST rodar via conexão direta (porta 5432); pooler em transaction mode quebra advisory locks e algumas DDLs.
- Papel `app_runtime` MUST NÃO ter `BYPASSRLS`; `current_user` em qualquer query Drizzle do runtime MUST retornar `app_runtime`.
- Nesta fatia, Drizzle NÃO é usado em código que depende de claims-por-usuário do JWT Clerk (RLS por `auth.jwt() ->> 'sub'`/`org_id` continua acessada via `supabase-js`).

**Scale/Scope**: Estágio inicial; volumes baixos (dezenas de orgs, centenas de memberships). Tabela projetada para crescer linearmente com membros — índice em `(user_id)` cobre o lookup "todas as orgs deste user"; PK composta `(org_id, user_id)` cobre lookup por org e upsert idempotente.

## Constitution Check

_GATE: passou antes de Phase 0; re-checado após Phase 1._

| Princípio                                        | Status              | Justificativa                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL)      | PASS                | `org_memberships` tem RLS ON; SELECT filtrado por `auth.jwt() ->> 'org_id'`; INSERT/UPDATE/DELETE bloqueados para `authenticated`. Tenant ID NUNCA vem de input do cliente. Papel `app_runtime` sujeito a RLS (sem `BYPASSRLS`). Drizzle nesta fatia explicitamente fora do contexto-por-usuário, então não há risco de bypass de RLS por falta de propagação de claims.                                                                                                                      |
| II. Stack Fixa e Simplicidade (YAGNI)            | PASS                | Drizzle ORM + Drizzle Kit + driver `postgres` são bibliotecas (não infraestrutura nova) e não alteram Vercel/Supabase/Clerk/Cloudflare. Nenhum serviço externo adicional. YAGNI respeitado: apenas `org_memberships`, papel restrito, ferramental — sem outras entidades, sem roles customizadas, sem soft-delete, sem migrar consumidores existentes.                                                                                                                                        |
| III. Entrega em Fatias Verticais                 | PASS                | Fatia única e demonstrável: ferramental Drizzle + tabela + sincronização. Testável isoladamente (`select 1` + handlers + backfill).                                                                                                                                                                                                                                                                                                                                                           |
| IV. Operações Pesadas São Assíncronas            | PASS                | Handlers de membership executam 2–3 upserts simples por evento, bem dentro do envelope síncrono. Backfill é script offline (`scripts/backfill-memberships.ts`), não roda em request path.                                                                                                                                                                                                                                                                                                     |
| V. Segurança e Integridade de Dados              | PASS                | TS `strict` mantido. Schema Zod valida payloads do Clerk antes do DB. Postgres como fonte de verdade: PK composta + FKs com cascade + NOT NULL em `role` + trigger `set_updated_at`. Senha do `app_runtime` via env, nunca versionada.                                                                                                                                                                                                                                                        |
| Quality Gates — substrato de teste de integração | EXCEÇÃO JUSTIFICADA | A constituição (seção "Fluxo de Desenvolvimento & Quality Gates") manda SQLite em memória para integração. Esta fatia usa Postgres efêmero (branch do Supabase) porque depende de RLS, triggers, papéis Postgres e `auth.jwt()` — recursos inexistentes em SQLite; testar contra SQLite seria teatro e perderia o backstop de isolamento multi-tenant (Princípio I). Detalhamento e justificativa em `research.md` R5 e em "Complexity Tracking" abaixo. Outras fatias permanecem com SQLite. |

**Resultado**: nenhum gate violado em sentido de bloqueio; uma exceção justificada ao substrato de integração registrada em "Complexity Tracking" abaixo.

## Project Structure

### Documentation (this feature)

```text
specs/002-drizzle-memberships/
├── plan.md                          # este arquivo
├── spec.md                          # spec + Clarifications
├── context.md                       # contexto herdado (já existia)
├── research.md                      # Phase 0 — decisões técnicas resolvidas
├── data-model.md                    # Phase 1 — entidades, relações, RLS
├── quickstart.md                    # Phase 1 — setup + reset + smoke test + rollout
├── contracts/
│   ├── db-client.md                 # API pública de lib/db/
│   ├── webhook-handlers.md          # contrato dos handlers organizationMembership.*
│   └── backfill-script.md           # contrato do script de backfill
├── checklists/
│   └── requirements.md              # spec quality checklist (já existia)
└── tasks.md                         # Phase 2 — gerado por /speckit-tasks (NÃO criado aqui)
```

### Source Code (repository root)

```text
sst-manager/
├── app/
│   └── api/
│       └── webhooks/
│           └── clerk/
│               └── route.ts                # EDIT: adicionar 3 handlers organizationMembership.*
│                                           #        + upsert defensivo de users/orgs
├── lib/
│   ├── db/                                 # NEW: tudo sob server-only
│   │   ├── index.ts                        # cliente Drizzle (pooler, transaction mode)
│   │   ├── schema/
│   │   │   ├── index.ts                    # barrel
│   │   │   ├── users.ts                    # schema autoritativo de public.users
│   │   │   ├── orgs.ts                     # schema autoritativo de public.orgs
│   │   │   └── org-memberships.ts          # nova tabela
│   │   ├── repositories/                   # helpers tipados para writes (upserts admin)
│   │   │   ├── users.ts
│   │   │   ├── orgs.ts
│   │   │   └── org-memberships.ts
│   │   └── migrations/                     # gerado por drizzle-kit generate
│   │       ├── 0000_initial_schema.sql
│   │       └── meta/_journal.json
│   ├── supabase/                           # MANTÉM (server.ts, browser.ts, admin.ts, env.ts)
│   └── clerk/
│       └── membership-event-mappers.ts     # NEW: mappers puros payload → row (testáveis isolados)
├── scripts/
│   ├── backfill-memberships.ts             # NEW: idempotente, paginação Clerk
│   └── db-reset-dev.ts                     # NEW: drop limpo no dev (tabelas/policies/trigger/role)
├── tests/
│   ├── unit/
│   │   ├── lib/db/                         # NEW: mappers + repositories (mocks)
│   │   └── webhooks/
│   │       └── membership-handlers.test.ts # NEW: lógica dos 3 handlers
│   └── integration/
│       └── webhooks/
│           └── clerk-membership.test.ts    # NEW: handlers + DB real efêmero + RLS
├── drizzle.config.ts                       # NEW
├── .env.example                            # EDIT
├── package.json                            # EDIT: deps + scripts db:*
└── supabase/                               # REMOVE ao final: migrations/ portadas
    └── migrations/0001_clerk_sync_init.sql # DELETE
```

**Structure Decision**: monorepo Next.js existente (projeto único). Toda lógica Drizzle vive em `lib/db/` (server-only), espelhando o padrão de `lib/supabase/`. Mappers puros payload→row ficam em `lib/clerk/` para serem unit-testáveis sem DB. Migrations centralizadas em `lib/db/migrations/` (única fonte). Testes seguem a divisão já existente (`tests/unit/`, `tests/integration/`).

## Complexity Tracking

| Item                                                                                                                                                                                       | Por que é necessário                                                                                                                                                                                                                                                                                                                                                                                                | Alternativa mais simples rejeitada e por quê                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Substrato de testes de integração = **Postgres efêmero** (branch do Supabase) em vez de **SQLite em memória** mandato pela constituição (seção "Fluxo de Desenvolvimento & Quality Gates") | Toda lógica de segurança crítica desta fatia (isolamento multi-tenant, menor privilégio, idempotência sob policies) só existe em Postgres: RLS, triggers SQL, papéis `nobypassrls`, `auth.jwt()` e funções do schema `auth.*`. Validar esse comportamento contra um banco que não tem nenhum desses recursos é teatro de teste e perde o backstop direto do Princípio I (Isolamento Multi-Tenant — NÃO-NEGOCIÁVEL). | (1) **SQLite em memória stub**: rejeitado — não suporta RLS, papéis nem `auth.jwt()`. Estimular esse comportamento em SQLite seria reimplementar metade do Postgres em userland, sem garantia de paridade. (2) **`pglite` (Postgres WASM em memória)**: rejeitado — não embarca o schema `auth.*` do Supabase nem honra `BYPASSRLS`/papéis customizados de forma confiável (R5). (3) **Docker Postgres local no CI**: viável, mas adiciona dependência de container ao pipeline; branch gerenciado do Supabase preserva paridade 1:1 com produção e é o caminho de menor atrito agora. Excepcionalidade desta fatia (mais detalhes em `research.md` R5). |

> Escopo da exceção: aplica-se **apenas** a esta fatia. Demais fatias seguem o padrão SQLite em memória prescrito pela constituição. Caso outra fatia futura precise reativar Postgres efêmero, ela deve registrar a própria entrada aqui ou justificar via emenda à constituição.
