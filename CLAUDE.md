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

Branch: **`feature/pgr-base-cruds`**. Fatia atual (`007`) — **CRUD completo** (criar, listar
paginado, detalhar, editar, excluir) das 5 entidades da cadeia do PGR (Empresa, Unidade de Obra,
Função, GES + gestão de `ges_job_roles`, Funcionário) em UI (App Router) + Server Actions, sobre
o modelo de dados da `006`. Consolida 5 cards (#69, #71, #12, #13, #14) numa fatia única.

Fatia atual (`007`) — `.specs/007-pgr-base-cruds/`:

- Plan: `.specs/007-pgr-base-cruds/plan.md`
- Spec (+ Clarifications 2026-06-20) / Research / Data model / Quickstart no mesmo diretório.
- Contracts: `contracts/action-result.md`, `contracts/server-actions.md`, `contracts/repositories.md`.
- Briefings (fonte): `docs/briefings/007-0{1..5}-*.md`.

Notas chave (`007`):

- **CRUD completo**: estende os repositórios da `006` (hoje só `list`/`create`) com
  `getById`/`update`/`delete`/busca + **paginação offset** (`{rows,total}`, pageSize 20); `createCompany`
  passa a persistir **todos** os campos da `006` (endereço/risk_grade/cnae/etc.).
- **Contrato de retorno**: `ActionResult<T> = {ok:true;data} | {ok:false;error:{code,message,fields?}}`
  em `src/shared/server/result.ts` (novo, FR-063) — segue a forma de `me.ts`; sem exceção crua na UI.
- **Autorização por papel** (FR-065): `requireOfficeStaff()` (novo) sobre `requireTenantContext().role`;
  `owner`/`collaborator` operam, papel `client` → `ForbiddenError`/403 (`app/forbidden.tsx`).
- **Exclusão**: confirmar-com-aviso (sem bloqueio); cascade/SET NULL pelo banco (`006`); helpers de
  contagem de dependentes p/ o aviso.
- **Isolamento (intacto)**: tudo via `withOrg` + RLS backstop; tenant da sessão, nunca do cliente.
  Nº de expostos derivado (reuso de `exposed-workers`). Server Actions em `server/actions/pgr/`,
  schemas/DTO em `domains/pgr/`. **Sem migration nova.**
- Testes: unit (zod/DTO/derivação/mapeamento de erro); integração de Server Actions + 404
  cross-tenant + isolamento contra **Postgres efêmero** (`INTEGRATION_*`/`runIsolationSuite`), nunca SQLite.

Fatia anterior (`006`) — `.specs/006-cadastros-base-pgr/` (modelo de dados; migration `0005`).

Notas chave (`006`):

- **Cadeia**: `companies` (ALTER) → `work_units` → `ges` → `ges_job_roles` ← `job_roles`;
  `employees` (`company_id*`, `ges_id`/`job_role_id` nullable); `categories` (catálogo
  `epi|machine`). `ges` **substitui** `sectors` do doc 02.
- **Isolamento (herdado, intacto)**: toda tabela nova + `companies` tem `org_id text NOT NULL
  → orgs.id` indexado, RLS `app_runtime` (`current_setting('app.current_org', true)`), GRANT —
  réplica de `tenant_probe`/`companies`. Acesso via `withOrg`; tenant ativo de
  `requireTenantContext()`, nunca de input do cliente.
- **Nº de trabalhadores expostos por GES**: **DERIVADO** por agregação na leitura
  (`SUM(worker_count)` de `ges_job_roles`); 0 sem associações; **sem coluna nem trigger**.
- **Integridade no banco**: 4 `pgEnum` (`category_type`, `employee_sex`, `marital_status`,
  `employee_status`); `CHECK risk_grade between 1 and 4`; `CHECK worker_count > 0`;
  `UNIQUE(org_id, cpf)` / `(org_id, ges_id, job_role_id)` / `(org_id, company_id, title)` /
  `(org_id, type, name)`. CNPJ **não** é único global.
- **ON DELETE**: `CASCADE` descendo a cadeia da empresa (`companies → work_units → ges →
  ges_job_roles` e `companies → employees`); `SET NULL` em `employees → ges/job_roles`.
- **`companies.razao_social` passa a `NOT NULL`**. Campos `*_path` (logo/foto) entram só
  como texto — upload é futuro.
- **Migration `0005_*`** (drizzle-kit) com GRANT + triggers `set_updated_at` como SQL custom
  (padrão `0001`/`0003`), aplicada via conexão direta unpooled (owner).
- **Fora desta fatia**: UI/formulários, lookup de CNPJ, ViaCEP, upload, tabela de CBO,
  vínculo com treinamentos, Server Actions de CRUD com interface, vínculo `employees`↔`risks`.
- Testes: unit (validação zod + agregação em mock); RLS/integridade/cadeia contra **Postgres
  efêmero** (`INTEGRATION_*`), nunca SQLite.

Histórico: Clerk auth (`001`); persistência Drizzle + `org_memberships` (`002`); reorganização
`src/` (`003`); isolamento multi-tenant + RLS backstop + `tenant_probe` (`004`); Modelo B de
tenant (escritório = `orgs.id`) + provisionamento + `companies` + campo de plano `free|pro` +
constituição v1.2.1 (`005`). Drizzle é dono code-first do schema; runtime conecta como
`app_runtime` (pooler 6543), `drizzle-kit` usa conexão direta como owner.

<!-- SPECKIT END -->
