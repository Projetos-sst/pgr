# Implementation Plan: Autenticação e Organizações (Clerk)

**Branch**: `feature/clerk-auth-foundation` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-clerk-auth/spec.md`

## Summary

Fatia fundacional do SST Manager: integrar **Clerk** como provedor de identidade e organizações no Next.js 16 App Router, expor `userId`/`orgId` no servidor a partir da sessão, bloquear o acesso à área de negócio sem autenticação e organização ativa, e disponibilizar telas mínimas de login, cadastro, seleção/criação de organização e uma página inicial autenticada. Nenhum dado de negócio é persistido nesta fatia — Clerk é a fonte de verdade para usuários, organizações e membros.

Abordagem técnica: `clerkMiddleware()` em `proxy.ts` (substituto do `middleware.ts` em Next.js 16) protegendo a área `(app)`; `<ClerkProvider>` no `app/layout.tsx`; helpers server-side `requireAuth()` e `requireOrgContext()` em `lib/auth/` para padronizar o guard em Server Actions/Route Handlers; rotas catch-all `/sign-in/[[...sign-in]]` e `/sign-up/[[...sign-up]]` com componentes hospedados do Clerk; `<OrganizationSwitcher>` no header autenticado; testes unitários (Jest + Testing Library) cobrindo os helpers e testes de integração cobrindo o comportamento dos guards (com `auth()` do Clerk mockado).

## Technical Context

**Language/Version**: TypeScript 5.x em modo `strict` (alias `@/*` → raiz do repo)

**Primary Dependencies**:
- **App**: Next.js 16.2.6 (App Router), React 19.2.4, Tailwind CSS v4, `@clerk/nextjs@latest`
- **Validação**: `zod` (validação de schema obrigatória em Server Actions/Route Handlers — constituição §V)
- **Testes**: `jest`, `@types/jest`, `ts-jest` (ou `@swc/jest`), `@testing-library/react`, `@testing-library/jest-dom`, `jest-environment-jsdom`

**Storage**: N/A nesta fatia. Identidade, organizações e membros vivem no Clerk. PostgreSQL (Supabase) entra a partir das fatias de negócio.

**Testing**:
- **Unitário** (`npm run test`, ambiente jsdom + node): helpers de `lib/auth/*`, componentes auxiliares; `@clerk/nextjs/server` mockado.
- **Integração** (`npm run test:integration`, ambiente node): execução dos guards em Server Actions/Route Handlers de exemplo (`whoamiAction`, route handler `/api/whoami`), mockando `auth()` para cobrir os cenários autenticado / não-autenticado / sem org / com troca de org. SQLite em memória **não** é necessário nesta fatia (sem DB); a infraestrutura entra quando a primeira fatia com persistência chegar.

**Target Platform**: Vercel (Node.js serverless), borda Cloudflare. Browsers evergreen (sem suporte legado).

**Project Type**: Web service fullstack (Next.js App Router unificado backend+frontend).

**Performance Goals**:
- TTFB da área autenticada < 800 ms p95 em região próxima.
- Login completo (clique em "Entrar" → dashboard) < 30 s (SC-004).
- Cadastro + criação de org + dashboard < 3 min no primeiro uso (SC-003).

**Constraints**:
- Cold start serverless: helpers de auth devem ser síncronos exceto pela chamada a `auth()`; sem I/O extra no caminho do guard.
- Strict TS sem `any` não justificado (constituição §V).
- Nenhum segredo no repo (`.env.local` gitignored; placeholders em `.env.example`).
- Tenant SEMPRE da sessão; `orgId` nunca aceito de input do cliente (constituição §I).
- `proxy.ts` (Next.js 16) executa em **Node.js runtime** — não é Edge Middleware. Cada request casado pelo `matcher` consome uma Function Invocation na Vercel; configurar o matcher de forma estreita (apenas o necessário) é fator de custo e de latência (research R13).

**Scale/Scope**:
- Fatia entrega ~12 arquivos novos de produto + ~6 arquivos de teste.
- Inicialmente 1–10 organizações em ambiente de validação; arquitetura suporta o que o Clerk suporta nativamente.

## Constitution Check

*GATE: Deve passar antes da Fase 0 e ser reavaliado após a Fase 1.*

| Princípio | Status | Como esta fatia atende |
|---|---|---|
| I. Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL) | ✅ PASS | É exatamente esta fatia que **cria** a fundação. `orgId` vem de `auth()` no servidor; helpers `requireOrgContext()` rejeitam toda operação sem org ativa. Nenhum input do cliente influencia o tenant. RLS no Supabase é responsabilidade de fatias seguintes (esta fatia não toca Supabase). |
| II. Stack Fixa e Simplicidade (YAGNI) | ✅ PASS | Clerk já está na constituição. Única adição de dep nova: `@clerk/nextjs` + libs de teste (Jest/RTL) + `zod`. Sem novos serviços. Sem features especulativas (papéis intra-org, SSO social, recuperação de senha custom, MFA enforcement — tudo fora de escopo). |
| III. Entrega em Fatias Verticais | ✅ PASS | Esta é uma fatia autocontida: login + cadastro + seleção de org + página autenticada + bloqueio universal. Testável e demonstrável isoladamente. Ciclo Spec Kit completo (specify → plan → tasks → implement). |
| IV. Operações Pesadas Assíncronas | ✅ N/A | Nenhuma operação pesada nesta fatia. Auth/lookup de org são rápidos e ficam no caminho síncrono normal. |
| V. Segurança e Integridade de Dados | ✅ PASS | TS strict; toda Server Action/Route Handler introduzida valida entrada com `zod` antes de qualquer trabalho; segredos só em `.env.local`; PostgreSQL não é tocado nesta fatia (sem schema novo). Testes unitários + integração obrigatórios e cobertos. |

**Resultado**: Sem violações. Sem entradas em Complexity Tracking.

**Reavaliação pós-Fase 1**: Decisões de design (helpers em `lib/auth/`, rotas catch-all, mock de `auth()` para testes) não introduzem complexidade extra nem violam princípios. Gate mantido **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/001-clerk-auth/
├── plan.md              # Este arquivo
├── research.md          # Fase 0: decisões e alternativas
├── data-model.md        # Fase 1: entidades (Clerk-resident) + contrato de sessão
├── quickstart.md        # Fase 1: como rodar e validar a fatia
├── contracts/
│   ├── server-helpers.md   # Contratos TS de requireAuth/requireOrgContext
│   └── ui-surface.md       # Contratos de UI (rotas, props, comportamento)
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec (já existe)
└── tasks.md             # Fase 2: gerado por /speckit-tasks (NÃO criado aqui)
```

### Source Code (repository root)

Next.js App Router monolítico (backend + frontend unificados). Sem `src/` (convenção atual do repo). Estrutura concreta após esta fatia:

```text
proxy.ts                                   # NEW: clerkMiddleware (Next.js 16; runtime Node)
.env.example                               # NEW: placeholders das chaves Clerk
next.config.ts                             # MOD: headers() com baseline de segurança (R12)
jest.config.ts                             # NEW: config Jest (projetos: unit, integration)
jest.setup.ts                              # NEW: setup global (RTL matchers, mocks padrão)

app/
├── layout.tsx                             # MOD: envolve <body> com <ClerkProvider>
├── page.tsx                               # MOD: landing pública com CTAs de sign-in/sign-up
├── unauthorized.tsx                       # NEW: UI 401 (renderizada por unauthorized())
├── forbidden.tsx                          # NEW: UI 403 (renderizada por forbidden())
├── globals.css                            # (inalterado)
├── (app)/                                 # NEW: route group da área autenticada
│   ├── layout.tsx                         # NEW: guard de auth + org via requireOrgContext
│   ├── dashboard/
│   │   └── page.tsx                       # NEW: página inicial autenticada (US3)
│   └── select-organization/
│       └── page.tsx                       # NEW: criar/entrar em org (US4) quando orgId ausente
├── sign-in/[[...sign-in]]/
│   └── page.tsx                           # NEW: <SignIn /> hospedado pelo Clerk
├── sign-up/[[...sign-up]]/
│   └── page.tsx                           # NEW: <SignUp /> hospedado pelo Clerk
└── api/
    └── whoami/
        └── route.ts                       # NEW: Route Handler de exemplo, valida guard

lib/
├── auth/                                  # DAL de identidade — import 'server-only' em todos
│   ├── require-auth.ts                    # NEW: helper server — exige userId
│   ├── require-org-context.ts             # NEW: helper server — exige (userId, orgId)
│   ├── errors.ts                          # NEW: UnauthorizedError, NoActiveOrgError
│   ├── types.ts                           # NEW: AuthContext, OrgAuthContext
│   └── __tests__/
│       ├── require-auth.test.ts           # NEW: unit
│       └── require-org-context.test.ts    # NEW: unit
├── server/
│   └── actions/
│       └── whoami.ts                      # NEW: Server Action de exemplo (server-only)
└── validation/
    └── parse.ts                           # NEW: parseOrThrow(schema, input) — Zod helper

tests/
└── integration/
    ├── auth-guards.test.ts                # NEW: integração — guards em SA + RH
    └── proxy-protection.test.ts           # NEW: integração — proxy.ts protege rota privada
```

**Structure Decision**:

Web service fullstack monolítico no Next.js — `app/` é a superfície de UI + handlers, `lib/` agrupa código compartilhado server/cliente, `tests/integration/` isola testes que executam Server Actions/Route Handlers de ponta a ponta. Não há separação `frontend/`/`backend/`: o framework já as unifica e a constituição §II proíbe complicar a stack. Testes unitários ficam ao lado do código (`__tests__/`) seguindo padrão Jest; testes de integração ficam centralizados em `tests/integration/` para que CI possa rodá-los em job separado (`npm run test:integration`).

## Complexity Tracking

*Sem violações à constituição — seção intencionalmente vazia.*
