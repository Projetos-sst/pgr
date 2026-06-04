# Implementation Plan: Reorganização `src/`, refatoração para código auto-explicativo e padrões

**Branch**: `feature/drizzle-orm-setup` | **Date**: 2026-06-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/003-src-layout-refactor/spec.md`

**Note**: Plano retrospectivo — documenta trabalho já entregue e validado nesta branch.

## Summary

Reorganização estrutural e de qualidade da base de código, sem alterar comportamento de runtime:
(1) todo o código de aplicação e testes movido para `src/`, com o alias `@/*` reapontado para
`./src/*` (nenhum import muda); (2) os comentários de "porquê" do código de produção convertidos em
código auto-explicativo (constante, função nomeada, rename revelador de risco); (3) DRY de
configuração duplicada (headers `no-store`), remoção dos scripts pontuais (`.scripts/`: migrate,
reset, backfill, guard) e do backfill — com o banco operado por `drizzle-kit migrate` e a proteção
anti-leak de bundle reimplementada como regra ESLint; (4) documento global de padrões de engenharia.
A camada de persistência Drizzle ORM + `org_memberships` permanece como em `002-drizzle-memberships`.

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), React 19.2.4

**Primary Dependencies**: Next.js 16.2.6 (App Router), Drizzle ORM 0.45, `@supabase/supabase-js`,
`@clerk/nextjs`, `zod`, `postgres` (postgres-js)

**Storage**: Supabase PostgreSQL via Supavisor (transaction pooler, porta 6543); Drizzle code-first.
Sem mudança de schema nesta fatia.

**Testing**: Jest + Testing Library (unitário); Jest + Postgres efêmero (integração, herdado de 002)

**Target Platform**: Vercel (serverless)

**Project Type**: Web app fullstack (Next.js — Server Actions + Route Handlers, sem API separada)

**Performance Goals**: N/A — refatoração sem mudança de comportamento; sem novas metas de performance

**Constraints**: Nenhum import de código pode mudar (apenas configs); o conjunto de verificações
(typecheck, eslint, guard de bundle, prettier, testes unitários) MUST permanecer verde

**Scale/Scope**: Fatia fundacional; ~35 módulos de produção sob `src/`, 10 suites unitárias (34 testes)

## Constitution Check

_GATE: revisado contra a Constituição v1.1.0._

| Princípio                  | Status        | Observação                                                                                                                                                                               |
| -------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Isolamento Multi-Tenant | ✅ Reforçado  | RLS, papel `app_runtime` e `orgId` da sessão intactos. O rename `getRlsBypassingSupabaseClient` torna o bypass de RLS explícito em cada call site — defesa em profundidade mais legível. |
| II. Stack Fixa / YAGNI     | ✅ Conforme   | Sem nova infraestrutura; `src/` é nativo do Next. Evitada reorganização DDD prematura (1 domínio real).                                                                                  |
| III. Fatias Verticais      | ⚠️ Estrutural | Não é fatia de módulo de negócio, e sim fatia habilitadora de estrutura/qualidade. Documentada via fluxo Spec Kit, testável e demonstrável isoladamente.                                 |
| IV. Operações Assíncronas  | ✅ N/A        | Sem operação pesada nova.                                                                                                                                                                |
| V. Segurança / Integridade | ✅ Conforme   | `strict` mantido; sem `any`; sem mudança de schema/constraints; segredos só em env (`.env.example` sem segredos).                                                                        |

**Desvio a registrar (não-negociável: honestidade)**: a seção _Restrições Técnicas & Stack_ da
Constituição afirma que "o alias `@/*` mapeia a **raiz** do repositório". Após esta fatia, `@/*`
mapeia `./src/*`, e `app/globals.css` passou a `src/app/globals.css`. Ver Complexity Tracking — é
um ajuste de restrição técnica (nível PATCH) que requer emenda da Constituição.

## Project Structure

### Documentation (this feature)

```text
.specs/003-src-layout-refactor/
├── plan.md              # Este arquivo
├── research.md          # Decisões técnicas resolvidas
├── data-model.md        # Entidades (sem mudança) + tipos novos
├── quickstart.md        # Setup e mapa da migração
├── contracts/
│   └── internal-interfaces.md
└── checklists/
    └── requirements.md  # Gerado pelo /speckit-specify
```

### Source Code (repository root)

```text
src/
├── app/                         # Rotas, layouts, páginas (App Router)
│   ├── (protected)/             # dashboard, layout autenticado
│   ├── (public)/                # home, sign-in, sign-up
│   └── api/                     # webhooks/clerk, whoami
├── proxy.ts                     # Middleware Next 16 (raiz do src)
├── lib/
│   ├── auth/                    # errors, get-session, policy, require-*, types
│   ├── clerk/                   # membership-event-mappers
│   ├── db/                      # index (cliente Drizzle), env, schema/, repositories/, migrations/
│   ├── http/                    # no-store (fonte única de headers)
│   ├── server/actions/          # whoami (Server Action)
│   ├── supabase/                # admin (RLS-bypass), browser, server, env
│   └── validation/              # parse, errors
└── __tests__/
    ├── unit/                    # repositórios, mappers, webhook handlers, db env
    └── integration/             # auth guards, webhook, db (Postgres efêmero)

# Raiz: apenas config e tooling (sem .scripts/)
# Banco via Drizzle nativo: db:generate / db:migrate (drizzle-kit) / db:studio
# Guard anti-leak de bundle: regra no-restricted-imports na eslint.config.mjs
tsconfig.json · jest.config.ts · drizzle.config.ts · next.config.ts · eslint.config.mjs · ...
public/ · docs/ · .specs/ · .specify/
```

**Structure Decision**: Layout single-project com `src/` (convenção oficial do Next.js). Código de
aplicação e testes sob `src/`; raiz reservada a configuração, tooling, assets e documentação.
`src/lib` usa agrupamento técnico (auth, db, supabase, …) — não DDD — adequado ao tamanho atual
(YAGNI). A evolução para `domains/` fica reservada para quando houver um segundo módulo de negócio.

## Complexity Tracking

| Violation                                                              | Why Needed                                                                                                                   | Simpler Alternative Rejected Because                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Constituição diz `@/*` → raiz; agora `@/*` → `src/`                    | A migração para `src/` separa código de aplicação de configuração (motivação central da fatia) e usa o layout nativo do Next | Manter `@/*` na raiz exigiria não migrar para `src/`, anulando o objetivo. O alias continua único e nenhum import muda — o impacto é só de texto na Constituição. **Ação**: emenda PATCH da seção _Restrições Técnicas_ (`@/*` → `src/`, `src/app/globals.css`). |
| Integração usa Postgres efêmero (não SQLite, como pede a Constituição) | Herdado de `002`: RLS/triggers/`auth.jwt()` não existem em SQLite                                                            | Já documentado e justificado em `002-drizzle-memberships`; esta fatia não alterou a infraestrutura de testes.                                                                                                                                                    |
