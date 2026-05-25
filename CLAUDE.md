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

Current active feature: **`feature/drizzle-orm-setup`** (Drizzle ORM + `org_memberships` — camada de persistência code-first).

Read the implementation plan and design artifacts before writing code:

- Plan: `specs/002-drizzle-memberships/plan.md`
- Spec: `specs/002-drizzle-memberships/spec.md` (+ `Clarifications` Session 2026-05-25)
- Research (decisões técnicas resolvidas): `specs/002-drizzle-memberships/research.md`
- Data model (entidades, RLS, triggers, papel restrito): `specs/002-drizzle-memberships/data-model.md`
- Contracts: `specs/002-drizzle-memberships/contracts/db-client.md`, `contracts/webhook-handlers.md`, `contracts/backfill-script.md`
- Quickstart (setup + reset + rollout): `specs/002-drizzle-memberships/quickstart.md`

Notas chave:

- Drizzle é **dono code-first único** da estrutura do banco; `supabase/migrations/` é removida ao final.
- Cliente Drizzle (`lib/db/index.ts`) conecta via pooler (porta 6543) como papel restrito `app_runtime`; `drizzle-kit` usa conexão direta (porta 5432) como `postgres`.
- Drizzle nesta fatia é **admin/sistema only** — dados por-usuário continuam via `@supabase/supabase-js` (que injeta o JWT do Clerk).
- Escritas em `users`/`orgs`/`org_memberships` continuam via `getSupabaseAdminClient()` no webhook; Drizzle compartilha apenas os tipos.
- Integração para esta fatia usa **Postgres efêmero** (branch Supabase), não SQLite, por causa de RLS/triggers/`auth.jwt()`. Outras fatias seguem com SQLite.
<!-- SPECKIT END -->
