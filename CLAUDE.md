# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — dev server at http://localhost:3000 · `npm run build` / `npm run start` — production build / serve it.
- `npm run lint` / `npm run lint:fix` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript).
- `npm run typecheck` — `tsc --noEmit` · `npm run format` / `format:check` — Prettier (+ Tailwind class sorting).
- `npm run fix` = lint:fix + format · `npm run check` = format:check + lint + typecheck + unit test (run before pushing).
- `npm run test` — **unit only** (`jest --selectProjects unit`, jsdom). Single test: `npx jest --selectProjects unit -t "<name>"` or `npx jest <path>`.
- `npm run test:integration` — integration (`--selectProjects integration`, node). Requires `INTEGRATION_DATABASE_URL` → an **ephemeral Postgres** (optionally `INTEGRATION_DATABASE_URL_ADMIN` for owner-level setup). There is no SQLite path despite older docs; the helper (`src/__tests__/integration/_helpers/db.ts`) applies migrations by splitting each `.sql` on `--> statement-breakpoint`.
- Schema/migrations via drizzle-kit (uses `DATABASE_URL_UNPOOLED`, owner connection): `npm run db:generate` (emit migration from schema), `db:migrate`, `db:studio`.

**Testing policy**: every feature MUST ship unit tests for business logic and integration tests for Server Actions / Route Handlers; multi-tenant isolation, authorization, and DB-constraint behavior are exercised against the ephemeral Postgres (see `.specify/memory/constitution.md`).

## Stack & conventions

- **Next.js 16.2.6** App Router (`src/app/`) + **React 19.2.4** — major version with breaking changes; consult `node_modules/next/dist/docs/` before writing framework code.
- **TypeScript** strict; import alias `@/*` → `./src/*` (not the repo root).
- **Tailwind CSS v4** CSS-first — no `tailwind.config.*`; tokens live in the `@theme inline` block of `app/globals.css`, loaded via `@tailwindcss/postcss`. Dark mode via `prefers-color-scheme` + `dark:` variants.
- **Drizzle ORM** + `postgres` (postgres-js) on Supabase Postgres · **Clerk** auth · **Zod v4** validation. Code/identifiers in English; spec/docs may be in PT.

## Architecture

Multi-tenant SST (occupational health & safety) platform. **Tenant isolation is the central invariant** and shapes every layer — the active tenant always comes from the session, never from client input.

**Tenant isolation — two enforced layers.** (1) App layer: every DB access goes through `withOrg(orgId, tx => …)` (`src/shared/db/with-org.ts`), which opens a transaction and `set_config('app.current_org', orgId, true)`. (2) DB backstop: every tenant table declares an RLS policy `org_id = current_setting('app.current_org', true)` for the `app_runtime` role, defined **in the Drizzle schema** via `pgPolicy(...).enableRLS()` (see `src/shared/db/schema/companies.ts` as the template). A query that forgets `withOrg` returns nothing rather than leaking across tenants.

**Request → core → data flow (layered).** Page / Route Handler *orchestrates only* → Server Action / domain → repository → Drizzle. Concretely: `src/app/**` (pages & `app/api/v1/**` handlers) → `src/shared/server/actions/pgr/*` (Server Actions) → `src/shared/domains/pgr/*` (Zod schemas + pure rules) → `src/shared/db/repositories/*` (all queries, each wrapping `withOrg` and returning `{rows,total}` via `src/shared/pagination.ts`) → `src/shared/db/schema/*`. Repositories own SQL; actions/handlers never touch Drizzle directly. Writes go through `auditedTenantWrite` (`repositories/audited-write.ts`).

**Two entry surfaces, one gate.** Server Actions are wrapped by `officeAction(operation, fn, {audit})` (`src/shared/server/office-action.ts`) → returns a discriminated `ActionResult<T>` (`{ok:true,data}` | `{ok:false,error}`, `server/result.ts`). REST `/api/v1/*` handlers are wrapped by `restHandler` (`src/shared/api/rest.ts`) → maps the same error codes to HTTP. Both call `requireOfficeStaff()` and share `toActionError` (`server/action-error.ts`). **Domain error codes** (not raw HTTP): `VALIDATION` (422), `DUPLICATE` (409, e.g. SQLSTATE 23505), `FK_NOT_FOUND`/`NOT_FOUND` (404/422), `FORBIDDEN`/`NO_TENANT_CONTEXT` (403), `UNAUTHORIZED` (401). REST has a **non-prod dev auth bypass** (`DEV_API_AUTH_BYPASS=true` + `x-dev-tenant`/`x-dev-role`/`x-dev-user` headers) — impossible in production.

**Auth & tenant resolution.** Clerk `ClerkProvider` is in the root layout (`src/app/layout.tsx`); there is **no `middleware.ts`** — protection is enforced in Server Components via `requireTenantContext()` / `requireOfficeStaff()` and the `(protected)/layout.tsx` redirect. `resolveActiveTenant` (`src/shared/tenant/active-tenant.ts`) reads `org_memberships`, picks the active org by the `ACTIVE_ORG_COOKIE` (defaulting to the personal org), auto-provisions a personal tenant on first login, and normalizes Clerk roles (`org:admin`/`org:member`) into domain roles `owner`/`collaborator`/`client` (unknown → least privilege `client`). `requireOfficeStaff()` admits only `owner`/`collaborator`. Clerk webhooks sync into the DB via `src/shared/clerk-sync/*`.

**Database ownership & connections.** Drizzle is the **code-first owner** of the schema (`drizzle.config.ts`, schema dir `src/shared/db/schema`). Two connections: runtime connects as the least-privileged `app_runtime` role through the Supabase transaction pooler (`DATABASE_URL`, port 6543, `prepare:false, max:1` — see `db/index.ts`); `drizzle-kit` uses a direct owner connection (`DATABASE_URL_UNPOOLED`). GRANTs and `set_updated_at` triggers live as **custom SQL inside the generated migrations** (not auto-emitted by drizzle-kit).

**Specs / Spec Kit.** Work is sliced under `.specs/NNN-*/` (spec, plan, contracts, tasks); the constitution is `.specify/memory/constitution.md`. `.specify/feature.json` is per-dev local session state (gitignored); feature numbering is timestamp-based to avoid collisions across concurrent devs.

<!-- SPECKIT START -->

Branch: **`feature/category-crud`**. Fatia atual (`009`) — **CRUD completo** (criar, listar
paginado/filtrado, carregar por id para edição, editar, excluir) da entidade **`categories`**
(catálogo `epi|machine`) em UI (App Router) + Server Actions, sobre o modelo da `006` e reusando
a infraestrutura de CRUD da `007`. Entidade simples (sem tela de detalhe; sem dependentes).

Fatia atual (`009`) — `.specs/009-category-crud/`:

- Plan: `.specs/009-category-crud/plan.md`
- Spec (+ revisão Tech Lead) / Research / Data model / Quickstart no mesmo diretório.
- Contracts: `contracts/server-actions.md`, `contracts/repositories.md`.

Notas chave (`009`):

- **CRUD de `categories`**: estende o repositório (hoje só `list`/`create`) com
  `getById`/`update`/`delete` + busca por nome + filtro por tipo + **paginação offset** (`{rows,total}`,
  pageSize 20). `createCategory` é **refatorado** para receber `CategoryValues` validado (deixa de
  fazer parse interno). **Sem migration nova** (tabela/constraint/RLS são da `006`).
- **Reuso integral da 007**: `ActionResult<T>` (`src/shared/server/result.ts`), wrapper
  `officeAction` (gate + mapeamento de erro + auditoria), `requireOfficeStaff()`, `_ui/list`+`_ui/form`.
  Domínio em `domains/pgr/categories.ts` (`categoryInputSchema` reusa `categoryTypeSchema`).
- **Erros como códigos do contrato** (não HTTP cru): duplicidade `(org,type,name)` → `DUPLICATE`
  (constraint `uq_categories_org_type_name`, SQLSTATE 23505); id inexistente/cross-tenant →
  `NOT_FOUND` (`NotFoundError`); tipo/nome inválidos → `VALIDATION`; papel `client` → `FORBIDDEN`.
- **Detalhe = edição** (sem tela só-leitura); **exclusão** = confirmar-e-remover (catálogo sem FK
  de entrada → sem aviso de cascata nem helper de dependentes).
- **Isolamento**: `withOrg` + RLS backstop; tenant da sessão, nunca do cliente. Ausência de tenant
  → bloqueada pelo gate (página/Server Action) e nunca devolve todos os registros (repo/RLS).
- Testes: unit (`categoryInputSchema`); integração de Server Actions + `DUPLICATE` + `NOT_FOUND`
  cross-tenant + `FORBIDDEN` contra **Postgres efêmero** (`INTEGRATION_*`; seed já tem
  `categoryA`@`org_a`/`categoryB`@`org_b`), nunca SQLite.

Fatia paralela (`008`) — `.specs/008-epi-data-model/`: **modelo de dados do módulo de EPIs**
(fundação da Fase 2 / paridade com o ePGR): 6 tabelas novas (`epi_catalog`, `epi_stock`,
`stock_movements`, `epi_deliveries`, `epi_delivery_items`, `epi_risk`) + 2 enums
(`stock_movement_type`, `epi_signature_status`), isoladas por tenant. Modelagem pura (schema +
migration `0007_epi_data_model` + RLS + testes), análoga à `006` — sem UI/Server Actions/CRUD.
`epi_catalog.category_id → categories` (FK composta `(category_id, type)` garantindo
`epi_catalog.type == categories.type`); `epi_risk → ges` interino (sem tabela `risks` ainda).
Mergeada via PR #116; **não** depende da `009` e vice-versa.

Fatia anterior (`007`) — `.specs/007-pgr-base-cruds/` (CRUD das 5 entidades da cadeia do PGR;
`ActionResult`/`officeAction`/`requireOfficeStaff`/`_ui`; sem migration). Briefings em
`docs/briefings/007-0{1..5}-*.md`.

Fatia base (`006`) — `.specs/006-cadastros-base-pgr/` (modelo de dados; migration `0005`).

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
