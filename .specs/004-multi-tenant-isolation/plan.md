# Implementation Plan: Isolamento Multi-Tenant — onboarding/troca de organização + backstop de RLS

**Branch**: `feature/multi-tenant-isolation` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/004-multi-tenant-isolation/spec.md`

## Summary

Entregar o isolamento multi-tenant em duas camadas coesas: **(A)** contexto de
tenant na aplicação — onboarding e troca da organização ativa via componentes
nativos do Clerk, com bloqueio de acesso sem org ativa; e **(B)** backstop de RLS
no Postgres pelo caminho do Drizzle/`app_runtime`, com um helper `withOrg` que
fixa o tenant por transação (`set_config('app.current_org', …, true)`), policies
`USING`/`WITH CHECK` por tabela e uma tabela de referência permanente que prova o
padrão. Eventos de fronteira de tenant geram log de auditoria estruturado.

A abordagem reaproveita ao máximo o que já existe: `requireOrgContext()` (resolve
`orgId` da sessão e lança `NoActiveOrgError`), o papel restrito `app_runtime` (sem
`BYPASSRLS`, já com GRANTs por migration), o ferramental Drizzle Kit (dono
code-first do schema) e o harness de integração contra **Postgres efêmero**
(`src/__tests__/integration/_helpers/db.ts`). Nenhuma infraestrutura nova.

## Technical Context

**Language/Version**: TypeScript 5 (`strict`); Next.js 16.2.6 (App Router); React 19.2.4

**Primary Dependencies**: `@clerk/nextjs` ^7.4.1 (Organizations — `<CreateOrganization>`, `<OrganizationList>`, `<OrganizationSwitcher>`); `drizzle-orm` ^0.45.2 (`pg-core`, `pgPolicy`, `pgRole`); `postgres` ^3.4.9 (postgres-js); `zod` ^4

**Storage**: Supabase PostgreSQL. Runtime conecta via Supavisor **transaction pooler** (porta 6543) como papel restrito **`app_runtime`** (sujeito a RLS); `drizzle-kit` usa a conexão **direta/unpooled** como owner para gerar/aplicar migrations.

**Testing**: Jest 30 + `@swc/jest`. Projeto `unit` (jsdom) e `integration` (node). Testes de DB/RLS rodam contra **Postgres efêmero** via `INTEGRATION_DATABASE_URL` / `INTEGRATION_APP_RUNTIME_URL` / `INTEGRATION_DATABASE_URL_ADMIN` (já estabelecido em `least-privilege.test.ts`); `describe.skip` quando o env não está presente.

**Target Platform**: Vercel serverless (Node runtime).

**Project Type**: Web — Next.js fullstack, projeto único, layout `src/`.

**Performance Goals**: Sem alvo específico (fatia de isolamento/CRUD). `withOrg` adiciona um `set_config` por transação — custo desprezível.

**Constraints**: A fixação do tenant MUST ser por transação (compatível com pooler em transaction mode); `SET LOCAL` literal não aceita bind param → usar `set_config('app.current_org', $1, true)`. A aplicação conecta **somente** como `app_runtime` (nunca `postgres`/`service_role`). Policies e `ENABLE RLS` entram via migration Drizzle Kit — nunca manualmente.

**Scale/Scope**: Multi-tenant; tabela de demonstração mínima; escopo = padrão + tabela de referência (RLS dos módulos reais vem nas fatias deles).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio                                       | Avaliação                                                                                                                                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL)** | ✅ É o objeto da fatia. `orgId` sempre da sessão Clerk (`requireOrgContext`); escopo na aplicação (`withOrg` + `WHERE`) como 1ª barreira; RLS como backstop pelo papel `app_runtime` sujeito a RLS; sem acesso sem org ativa. |
| **II. Stack Fixa e Simplicidade (YAGNI)**       | ✅ Zero infra nova. Componentes nativos do Clerk; Drizzle/postgres-js já presentes; logger estrutural reaproveitado. Tabela de demonstração mínima.                                                                           |
| **III. Entrega em Fatias Verticais**            | ✅ Fatia única e coesa, testável e demonstrável isoladamente; P1 → P3 priorizados na spec.                                                                                                                                    |
| **IV. Operações Pesadas Assíncronas**           | ✅ N/A — não há operação pesada.                                                                                                                                                                                              |
| **V. Segurança e Integridade de Dados**         | ✅ TS `strict`; tenant nunca de input do cliente; `set_config` parametrizado (sem injeção); constraints (`NOT NULL`, índice) na tabela de demonstração; segredos só em env; logs sem PII/segredos.                            |

**Resultado**: PASS — sem violações. **Complexity Tracking** vazio.

## Project Structure

### Documentation (this feature)

```text
.specs/004-multi-tenant-isolation/
├── plan.md              # Este arquivo
├── spec.md              # Especificação (+ Clarifications 2026-06-17)
├── research.md          # Phase 0 — decisões técnicas
├── data-model.md        # Phase 1 — tabela de demonstração + GUC
├── quickstart.md        # Phase 1 — como rodar, testar e replicar o padrão
├── contracts/
│   ├── withorg-and-rls.md      # Contrato withOrg + policy/role/GUC
│   ├── onboarding-and-shell.md # Rotas, componentes Clerk, bloqueio
│   └── audit-events.md         # Eventos de auditoria de fronteira de tenant
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (protected)/
│   │   ├── layout.tsx              # refatorado: shell + bloqueio → /onboarding
│   │   ├── onboarding/page.tsx     # NOVO — <CreateOrganization/> + <OrganizationList/>
│   │   └── dashboard/page.tsx
│   └── (public)/ ...
├── shared/
│   ├── auth/
│   │   ├── require-org-context.ts  # reutilizado (resolve orgId, NoActiveOrgError)
│   │   └── ...
│   ├── db/
│   │   ├── index.ts                # client postgres-js (app_runtime, pooler)
│   │   ├── with-org.ts             # NOVO — withOrg(orgId, fn): SET via set_config
│   │   ├── roles.ts                # NOVO — pgRole("app_runtime").existing()
│   │   ├── schema/
│   │   │   ├── tenant-probe.ts     # NOVO — tabela de referência + pgPolicy GUC
│   │   │   └── index.ts            # re-export
│   │   └── migrations/             # 0003_* gerada por drizzle-kit (RLS demo)
│   ├── tenant/
│   │   └── audit-log.ts            # NOVO — logTenantEvent (espelha logClerkSync)
│   └── ...
└── __tests__/
    ├── unit/                       # detecção sem-org, resolução orgId, bloqueio
    └── integration/
        ├── _helpers/db.ts          # estendido: setCurrentOrg / withOrg helper
        ├── shared/db/tenant-isolation.test.ts   # NOVO — caminho crítico RLS
        └── auth/onboarding-guard.test.ts        # NOVO — bloqueio app-layer
```

**Structure Decision**: Projeto único Next.js fullstack com layout `src/` (herdado da fatia 003). A lógica de tenant fica em `src/shared/` (db, auth, tenant); as telas em `src/app/(protected)/`. Segue a separação já estabelecida e o alias `@/*` → `./src/*`.

## Complexity Tracking

> Sem violações constitucionais — seção não aplicável.
