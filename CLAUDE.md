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

Branch: **`feature/multi-tenant-isolation`**. Entrega o isolamento multi-tenant de
ponta a ponta (`004`): onboarding/troca de organização + backstop de RLS.

Fatia atual (`004`) — `.specs/004-multi-tenant-isolation/`:

- Plan: `.specs/004-multi-tenant-isolation/plan.md`
- Spec (+ Clarifications 2026-06-17) / Research / Data model / Quickstart no mesmo diretório.
- Contracts: `contracts/withorg-and-rls.md`, `contracts/onboarding-and-shell.md`, `contracts/audit-events.md`.

Notas chave (`004`):

- **Duas camadas**: escopo por org na aplicação (1ª barreira) + RLS no Postgres (backstop).
- `orgId` vem **sempre** da sessão Clerk via `requireOrgContext()` — nunca de input do cliente.
- Helper `withOrg(orgId, fn)` abre transação e fixa o tenant com
  `set_config('app.current_org', $1, true)` (parametrizado; escopo por transação, compatível com pooler).
- Policies do caminho **Drizzle/`app_runtime`** usam `current_setting('app.current_org', true)` (`USING`/`WITH CHECK`),
  distintas das policies `auth.jwt()`/`authenticated` (caminho `supabase-js`) das tabelas core.
- Tabela de referência permanente `tenant_probe` demonstra o padrão via migration; cada módulo futuro herda.
- Onboarding e seletor usam componentes nativos do Clerk; sem org ativa → `/onboarding` (sem render de negócio).
- Auditoria de fronteira de tenant via `logTenantEvent` (sem PII/segredos).
- Testes: bloqueio app-layer com `auth()` mockado (sem DB); RLS contra **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite.

Histórico: persistência Drizzle + `org_memberships` (`002`, `.specs/002-drizzle-memberships/`);
reorganização `src/` (`003`, `.specs/003-src-layout-refactor/`). Drizzle é dono code-first único do schema;
runtime conecta como `app_runtime` (pooler 6543), `drizzle-kit` usa conexão direta como owner.
<!-- SPECKIT END -->
