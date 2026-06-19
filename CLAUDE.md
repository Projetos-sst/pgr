# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start the dev server at http://localhost:3000
- `npm run build` — production build
- `npm run start` — serve the production build (run `build` first)
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)

- `npm run test` — testes unitários (Jest + Testing Library)
- `npm run test:integration` — testes de integração com SQLite em memória

**Obrigatoriedade de testes**: toda feature MUST incluir testes unitários para lógica de negócio e testes de integração para Server Actions e Route Handlers. Testes de integração usam SQLite em memória como banco substituto.

## Stack & conventions

- **Next.js 16.2.6** with the App Router (`app/` directory) and React 19.2.4. As `AGENTS.md` warns, this is a major version with breaking changes vs. older Next.js — consult `node_modules/next/dist/docs/` before writing framework code.
- **Tailwind CSS v4** — configured CSS-first. There is no `tailwind.config.*`; theme tokens live in the `@theme inline` block of `app/globals.css`, and PostCSS loads it via `@tailwindcss/postcss`.
- **TypeScript** in `strict` mode. Import alias `@/*` maps to the repo root (see `tsconfig.json`).
- Theming uses CSS custom properties (`--background`, `--foreground`) with a `prefers-color-scheme: dark` override; Tailwind `dark:` variants are used throughout components.

<!-- SPECKIT START -->

Branch: **`feature/modelo-tenant-gate-pro`**. Corrige a premissa de tenant da `004` e
estabelece a fundação de identidade/membership do **Modelo B** + o campo de plano (`005`).

Fatia atual (`005`) — `.specs/005-modelo-tenant-gate-pro/`:

- Plan: `.specs/005-modelo-tenant-gate-pro/plan.md`
- Spec (+ Clarifications 2026-06-19) / Research / Data model / Quickstart no mesmo diretório.
- Contracts: `contracts/tenant-model-and-migrations.md`, `contracts/tenant-provisioning.md`, `contracts/tenant-context-resolution.md`.
- Briefing (fonte): `docs/briefing-equipe-acessos-gate-pro.md`.

Notas chave (`005`):

- **Modelo B**: tenant = **escritório** (nosso `orgs.id`), não a org do Clerk. Empresa-cliente
  (`companies`, `org_id`) é **dimensão** dentro do tenant, não fronteira de isolamento.
- **Correção da `004`**: o tenant ativo vem das **nossas** `org_memberships` (chaveadas pelo
  `userId` da sessão) via novo `requireTenantContext()` — **não** de `session.orgId` (free
  não tem Clerk Org). `requireOrgContext()` é mantido para o caminho Clerk-org do PRO (futuro).
- **Provisionamento**: `user.created` (clerk-sync) chama `provisionPersonalTenant(userId)`
  idempotente → cria `orgs(plan='free', clerk_org_id=null)` + membership `owner`; self-heal
  no `requireTenantContext()` se 0 memberships (corrida de webhook).
- **Plano**: `orgs.plan` `NOT NULL DEFAULT 'free' CHECK in ('free','pro')` — **campo apenas**,
  sem enforcement. Plano é do **tenant ativo** (Inv-1), nunca do usuário.
- **Schema**: +`orgs.plan`/`clerk_org_id`(unique nullable); +`org_memberships.scoped_company_id`
  (FK companies, p/ papel `cliente` futuro); +`companies` (RLS por `org_id`, herda
  `tenant_probe`; único `(org_id,cnpj)`, sem único global). Migration `0004_*` (GRANT custom).
- **Motor de isolamento da `004` intacto**: `withOrg` + `set_config('app.current_org', …)`,
  policies `app_runtime`/GUC, `tenant_probe`, `logTenantEvent`. Muda só a **origem** do id.
- **Fora desta fatia**: enforcement do gate, convite/UI Equipe e Acessos, auto-criação de
  Clerk Org no upgrade, policy de escopo por empresa do `cliente`, seletor, billing.
- **Constituição emendada → v1.2.1**: Princípio I agora reflete o Modelo B (tenant = nosso
  `orgs.id` resolvido da sessão via `org_memberships`; empresa-cliente = dimensão interna;
  Clerk Org = UI B2B do PRO, opcional). Regra não-negociável preservada (tenant da sessão,
  nunca do cliente).
- Testes: unit/app-layer em mock/SQLite; RLS de `companies` contra **Postgres efêmero**
  (`INTEGRATION_*`), nunca SQLite.

Histórico: Clerk auth (`001`); persistência Drizzle + `org_memberships` (`002`); reorganização
`src/` (`003`); isolamento multi-tenant + RLS backstop + `tenant_probe` (`004`). Drizzle é dono
code-first do schema; runtime conecta como `app_runtime` (pooler 6543), `drizzle-kit` usa
conexão direta como owner.

<!-- SPECKIT END -->
