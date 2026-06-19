# Implementation Plan: Modelo de tenant multiempresa + fundação de Equipe e Acessos com Gate PRO

**Branch**: `feature/modelo-tenant-gate-pro` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/005-modelo-tenant-gate-pro/spec.md`

## Summary

Corrige a premissa de tenant da fatia `004` e estabelece a fundação de identidade/
membership do Modelo B, entregando três coisas implementáveis: **(1)** todo usuário ganha
um **tenant próprio** (linha em `orgs`, papel `owner`) no cadastro — inclusive contas
free, que **não** têm Clerk Organization; **(2)** o **campo de plano** `plan` (`free|pro`,
default `free`) em `orgs`; e **(3)** o **modelo estrutural** que sustenta as invariantes —
`org_memberships` com papel + `scoped_company_id`, e a entidade de negócio `companies`
(empresa-cliente) isolada pelo mesmo backstop de RLS por tenant.

A correção central: em `004`, o tenant ativo vinha da **org ativa do Clerk**
(`session.orgId` via `requireOrgContext()`). No Modelo B um usuário free **não tem org no
Clerk**, então `session.orgId` é nulo. O tenant ativo passa a ser resolvido a partir das
**nossas** `org_memberships` (chaveadas pelo `userId` da sessão) — nunca de input do
cliente. O motor de isolamento da `004` (`withOrg` + `set_config('app.current_org', …)`,
policies `app_runtime`/GUC, `tenant_probe`, `logTenantEvent`) permanece **intacto**; muda
apenas a **origem** do identificador de tenant e nasce a dimensão `company_id`.

Reaproveita ao máximo o que existe: `clerk-sync-service` (webhooks `user.*`/`org.*`/
`membership.*`), repositórios admin (`getRlsBypassingSupabaseClient`), `withOrg`,
`tenant_probe` como padrão canônico e o harness de integração contra **Postgres efêmero**.
Nenhuma infraestrutura nova. **Enforcement do gate, fluxo de convite, auto-criação de
Clerk Org, seletor e policy de escopo por empresa do `cliente` ficam fora desta fatia**
(apenas o modelo é criado agora).

## Technical Context

**Language/Version**: TypeScript 5 (`strict`); Next.js 16.2.6 (App Router); React 19.2.4

**Primary Dependencies**: `@clerk/nextjs` ^7.4.1 (sessão/webhooks; **não** Organizations
nesta fatia); `drizzle-orm` ^0.45.2 (`pg-core`, `pgPolicy`, `pgRole`); `drizzle-kit`
^0.31.10 (dono code-first do schema, gera migrations); `postgres` ^3.4.9 (postgres-js,
runtime como `app_runtime`); `@supabase/supabase-js` ^2.106.1 (admin/RLS-bypassing nos
repositórios de sync); `zod` ^4 (validação de entrada).

**Storage**: Supabase PostgreSQL. Runtime conecta via Supavisor **transaction pooler**
(6543) como `app_runtime` (sujeito a RLS); `drizzle-kit` usa conexão direta/unpooled
(`DATABASE_URL_UNPOOLED`) como owner para gerar/aplicar migrations. Repositórios de sync de
webhook usam o cliente Supabase admin (service_role, RLS-bypassing) — padrão da `002`.

**Testing**: Jest 30 + `@swc/jest`. Projetos `unit` (jsdom) e `integration` (node). Testes
de RLS/policies rodam contra **Postgres efêmero** via `INTEGRATION_DATABASE_URL` /
`INTEGRATION_APP_RUNTIME_URL` / `INTEGRATION_DATABASE_URL_ADMIN` (`describe.skip` quando o
env não está presente) — padrão já estabelecido em `least-privilege.test.ts` e
`tenant-isolation.test.ts`.

**Target Platform**: Vercel serverless (Node runtime).

**Project Type**: Web — Next.js fullstack, projeto único, layout `src/` (herdado da `003`).

**Performance Goals**: Sem alvo específico (fatia de modelo/provisionamento). Resolver o
tenant ativo adiciona, no pior caso (cold start sem membership), um `SELECT` + um `INSERT`
idempotente; o caminho quente é um `SELECT` de membership.

**Constraints**: O tenant ativo MUST vir da sessão (`userId`) + `org_memberships`, NUNCA
de input do cliente. A fixação do tenant continua por transação
(`set_config('app.current_org', $1, true)`, parametrizado, compatível com pooler). RLS e
GRANTs entram via migration Drizzle Kit (GRANTs como SQL custom, padrão do `0003`) — nunca
manualmente. `CHECK (plan in ('free','pro'))` e demais constraints no banco (Princípio V).

**Scale/Scope**: Multi-tenant de alto volume e baixo ticket (profissionais solo). Esta
fatia entrega o modelo + provisionamento + campo de plano; CRUD de `companies`,
enforcement e UI vêm em fatias futuras.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Avaliação |
| --- | --- |
| **I. Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL)** | ✅ É o objeto da fatia. O tenant ativo passa a vir da sessão (`userId`) + `org_memberships` (nossas), nunca de input do cliente; backstop de RLS por `org_id` via `app_runtime`/GUC herdado da `004` e estendido a `companies`. A Constituição foi **emendada (v1.2.1)** para refletir o Modelo B: o identificador de tenant é o nosso `orgs.id` resolvido da sessão (não a org do Clerk), com empresa-cliente (`company_id`) como dimensão interna. A regra não-negociável (tenant da sessão, jamais do cliente) é preservada e reforçada. Ver "Nota de constituição" abaixo. |
| **II. Stack Fixa e Simplicidade (YAGNI)** | ✅ Zero infra nova. Mantém `orgs.id text` (evita migração destrutiva text→uuid e reescrita de FKs/webhook); adiciona apenas colunas e uma tabela. Sem enforcement/convite/seletor especulativos — só o modelo. |
| **III. Entrega em Fatias Verticais** | ✅ Fatia coesa e demonstrável; P1 (tenant no cadastro + isolamento + campo de plano) funcional antes do resto. Requisitos _(futuro)_ ficam registrados, não implementados. |
| **IV. Operações Pesadas Assíncronas** | ✅ N/A — sem operação pesada. Provisionamento é um par de upserts idempotentes. |
| **V. Segurança e Integridade de Dados** | ✅ TS `strict`; validação de schema (zod) nas Server Actions/handlers; constraints no banco: `plan` `NOT NULL` default `free` + `CHECK in ('free','pro')`, FK `companies.org_id`→`orgs.id`, FK `scoped_company_id`→`companies.id`, `clerk_org_id` único nullable, índices por `org_id`. Segredos só em env; logs sem PII. |

**Resultado**: PASS — sem violações. **Complexity Tracking** vazio.

**Nota de constituição (emenda aplicada)**: a Constituição foi emendada de v1.2.0 para
**v1.2.1** (PATCH) nesta fatia. O Princípio I deixou de descrever o identificador de tenant
como "(organização do Clerk)" e passou a refletir o Modelo B: o tenant é o nosso `orgs.id`,
resolvido da sessão via `org_memberships`; a empresa-cliente (`company_id`) é dimensão
interna, não fronteira; a org do Clerk é apenas a camada de UI B2B do PRO
(`orgs.clerk_org_id`), opcional, e contas free têm tenant isolado sem org no Clerk. Nenhuma
regra foi relaxada — o tenant continua vindo da sessão autenticada e nunca de input do
cliente. A linha Auth/Multi-tenant de "Restrições Técnicas & Stack" foi ajustada à mesma
premissa. Decisão de emendar/superseder a `004` (artefatos da fatia) permanece do humano
(spec §"Relação com a 004").

## Project Structure

### Documentation (this feature)

```text
.specs/005-modelo-tenant-gate-pro/
├── plan.md              # Este arquivo
├── spec.md              # Especificação (+ Clarifications 2026-06-19)
├── research.md          # Phase 0 — decisões técnicas (id do tenant, resolução, provisionamento)
├── data-model.md        # Phase 1 — orgs(+plan,+clerk_org_id), memberships(+scoped_company_id), companies
├── quickstart.md        # Phase 1 — como rodar, migrar, testar e replicar o padrão
├── contracts/
│   ├── tenant-model-and-migrations.md  # Schema + RLS + migration (orgs/memberships/companies)
│   ├── tenant-provisioning.md          # Cadastro → tenant próprio + membership owner (idempotente)
│   └── tenant-context-resolution.md    # Tenant ativo das nossas memberships + withOrg + bloqueio + plano
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (protected)/
│   │   └── layout.tsx                 # ajustado: bloqueio usa requireTenantContext (sem org ativa Clerk p/ free)
│   └── api/webhooks/clerk/route.ts    # inalterado (delega ao clerk-sync-service)
├── shared/
│   ├── auth/
│   │   ├── require-org-context.ts     # mantido (caminho Clerk-org, usado por PRO no futuro)
│   │   ├── require-tenant-context.ts  # NOVO — resolve tenant ativo das nossas org_memberships
│   │   └── errors.ts                   # +NoTenantContextError (ou reusa NoActiveOrgError)
│   ├── clerk-sync/
│   │   └── clerk-sync-service.ts      # user.created → também provisiona tenant pessoal (idempotente)
│   ├── tenant/
│   │   ├── provision-personal-tenant.ts # NOVO — cria orgs(plan=free) + membership owner, idempotente
│   │   ├── active-tenant.ts            # NOVO — resolução do tenant ativo (1 membership → ele)
│   │   ├── plan.ts                     # NOVO — resolvePlan(tenant) / isFeatureAvailable (campo apenas)
│   │   ├── audit-log.ts                # reutilizado (logTenantEvent)
│   │   └── org-switch.ts               # reutilizado (reconcileActiveOrg)
│   └── db/
│       ├── with-org.ts                # reutilizado (withOrg)
│       ├── roles.ts                   # reutilizado (appRuntimeRole)
│       ├── repositories/
│       │   ├── orgs.ts                # +plan/+clerk_org_id em toOrgColumns/mapOrg; createTenant()
│       │   ├── org-memberships.ts     # +scoped_company_id; ensureOwnerMembership()
│       │   └── companies.ts           # NOVO — repo admin de companies
│       ├── schema/
│       │   ├── orgs.ts                # +plan (CHECK), +clerk_org_id (unique nullable)
│       │   ├── org-memberships.ts     # +scoped_company_id (FK companies, nullable)
│       │   ├── companies.ts           # NOVO — pgTable + pgPolicy GUC (.enableRLS())
│       │   └── index.ts               # +export companies
│       └── migrations/                # 0004_* gerada por drizzle-kit (+GRANTs custom p/ companies)
└── __tests__/
    ├── unit/
    │   ├── tenant/provision-personal-tenant.test.ts  # NOVO — idempotência, papel owner, plano free
    │   ├── tenant/active-tenant.test.ts              # NOVO — 1 membership → ativo; 0 → provisiona/bloqueia
    │   └── tenant/plan.test.ts                       # NOVO — default free; resolve pelo tenant ativo
    └── integration/
        ├── webhooks/clerk-user-provisioning.test.ts # NOVO — user.created cria tenant + owner (idempotente)
        └── shared/db/
            ├── companies-isolation.test.ts          # NOVO — RLS de companies (A só vê A; sem tenant, vazio; write cross rejeitada)
            └── tenant-isolation.test.ts             # reutilizado (tenant_probe — padrão herdado)
```

**Structure Decision**: Projeto único Next.js fullstack, layout `src/`. A lógica de tenant
fica em `src/shared/tenant/` e `src/shared/db/`; a resolução de contexto em
`src/shared/auth/`. Segue a separação da `003`/`004` e o alias `@/*` → `./src/*`. Nomes de
arquivo/símbolo definitivos podem ser ajustados no `/speckit-tasks`; o que importa é a
fronteira: **provisionamento** (sync/webhook), **resolução de contexto** (auth) e **modelo/
RLS** (db).

## Complexity Tracking

> Sem violações constitucionais — seção não aplicável.
