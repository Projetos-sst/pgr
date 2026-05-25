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
Current active feature: **`feature/clerk-auth-foundation`** (Autenticação e Organizações — Clerk).

Read the implementation plan and design artifacts before writing code:
- Plan: `specs/001-clerk-auth/plan.md`
- Spec: `specs/001-clerk-auth/spec.md`
- Research (decisions + best practices): `specs/001-clerk-auth/research.md`
- Data model & session contract: `specs/001-clerk-auth/data-model.md`
- Contracts: `specs/001-clerk-auth/contracts/server-helpers.md`, `specs/001-clerk-auth/contracts/ui-surface.md`
- Quickstart: `specs/001-clerk-auth/quickstart.md`
<!-- SPECKIT END -->
