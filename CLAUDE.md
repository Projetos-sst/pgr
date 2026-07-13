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

**Request → core → data flow (layered).** Page / Route Handler _orchestrates only_ → Server Action / domain → repository → Drizzle. Concretely: `src/app/**` (pages & `app/api/v1/**` handlers) → `src/shared/server/actions/pgr/*` (Server Actions) → `src/shared/domains/pgr/*` (Zod schemas + pure rules) → `src/shared/db/repositories/*` (all queries, each wrapping `withOrg` and returning `{rows,total}` via `src/shared/pagination.ts`) → `src/shared/db/schema/*`. Repositories own SQL; actions/handlers never touch Drizzle directly. Writes go through `auditedTenantWrite` (`repositories/audited-write.ts`).

**Two entry surfaces, one gate.** Server Actions are wrapped by `officeAction(operation, fn, {audit})` (`src/shared/server/office-action.ts`) → returns a discriminated `ActionResult<T>` (`{ok:true,data}` | `{ok:false,error}`, `server/result.ts`). REST `/api/v1/*` handlers are wrapped by `restHandler` (`src/shared/api/rest.ts`) → maps the same error codes to HTTP. Both call `requireOfficeStaff()` and share `toActionError` (`server/action-error.ts`). **Domain error codes** (not raw HTTP): `VALIDATION` (422), `DUPLICATE` (409, e.g. SQLSTATE 23505), `FK_NOT_FOUND`/`NOT_FOUND` (404/422), `FORBIDDEN`/`NO_TENANT_CONTEXT` (403), `UNAUTHORIZED` (401). REST has a **non-prod dev auth bypass** (`DEV_API_AUTH_BYPASS=true` + `x-dev-tenant`/`x-dev-role`/`x-dev-user` headers) — impossible in production.

**API surface — MANDATORY for every CRUD / HTTP-exposed feature.** Do not consider a CRUD "done" until **all four** ship together in the same PR — reviewers block a CRUD PR that is missing any of them (this is the checklist devs keep forgetting):

1. **Server Action** wrapped by `officeAction(...)` returning `ActionResult<T>` — the UI entry (POST-only by Next design, not RESTful, not Postman-testable).
2. **RESTful Route Handler mirror** under `src/app/api/v1/<resource>/**` wrapped by `restHandler(...)`, with **real verbs**: `GET` (list) + `POST` (create) on `/<resource>`; `GET`/`PUT`/`DELETE` on `/<resource>/[id]`; add `/[id]/dependents` when the entity has inbound FKs. Reuse the **same** repository, zod schema and `toActionError` — never re-implement the rule. `201` on create, `204` on delete. This is the only Postman/cURL-testable surface.
3. **Docs** — register the resource, verbs and filters in `docs/api/api-design.md` (the "Recursos" and "Sumário" tables).
4. **Postman** — add the requests to the single collection `docs/api/sst-manager.postman_collection.json` (one folder per resource, mirroring the existing ones; reuse the collection Variables `baseUrl`/`devTenant`/`devRole`/ids). Keep it to **one** file on purpose.

Reference implementation to copy from: **companies** (`actions/pgr/companies.ts` + `app/api/v1/companies/**` + its api-design section + Postman folder). External/utility integrations (ViaCEP/CNPJ, later CAEPI) are the exception to the tenant rule and live under `src/app/api/integrations/**` — session-guarded via `requireAuth()` (no tenant/role, public data), but still documented in api-design.md + Postman the same way.

**Auth & tenant resolution.** Clerk `ClerkProvider` is in the root layout (`src/app/layout.tsx`); there is **no `middleware.ts`**, but `src/proxy.ts` (Next 16's renamed middleware) runs `clerkMiddleware` → `auth.protect()` on every non-public route (public: `/`, `/sign-in`, `/sign-up`, `/api/webhooks/*`, and `/api/v1/*` only when the dev bypass flag is on) — so unauthenticated `/api/**` calls get a 307/redirect before reaching the handler. Protection is **also** enforced in Server Components via `requireTenantContext()` / `requireOfficeStaff()` and the `(protected)/layout.tsx` redirect (defense in depth). `resolveActiveTenant` (`src/shared/tenant/active-tenant.ts`) reads `org_memberships`, picks the active org by the `ACTIVE_ORG_COOKIE` (defaulting to the personal org), auto-provisions a personal tenant on first login, and normalizes Clerk roles (`org:admin`/`org:member`) into domain roles `owner`/`collaborator`/`client` (unknown → least privilege `client`). `requireOfficeStaff()` admits only `owner`/`collaborator`. Clerk webhooks sync into the DB via `src/shared/clerk-sync/*`.

**Database ownership & connections.** Drizzle is the **code-first owner** of the schema (`drizzle.config.ts`, schema dir `src/shared/db/schema`). Two connections: runtime connects as the least-privileged `app_runtime` role through the Supabase transaction pooler (`DATABASE_URL`, port 6543, `prepare:false, max:1` — see `db/index.ts`); `drizzle-kit` uses a direct owner connection (`DATABASE_URL_UNPOOLED`). GRANTs and `set_updated_at` triggers live as **custom SQL inside the generated migrations** (not auto-emitted by drizzle-kit).

**Specs / Spec Kit.** Work is sliced under `.specs/NNN-*/` (spec, plan, contracts, tasks); the constitution is `.specify/memory/constitution.md`. `.specify/feature.json` is per-dev local session state (gitignored); feature numbering is timestamp-based to avoid collisions across concurrent devs.

<!-- SPECKIT START -->

Branch atual: **`feature/training-module`**. Fatia atual (`017`) — **Módulo de Treinamentos / Fase 04
completa** (issues `#28`/`#29`/`#30`/`#31`/`#80`). Plan: `.specs/017-training-module/plan.md`
(spec/research/data-model/contracts/quickstart no mesmo diretório). Base `develop` pós-#142 (última
migration `0015_ai_usage_events`); esta leva traz a **`0016_training_module`** (renumerada de `0015`
no rebase — a `0015` é a `ai_usage_events` da fatia 016) — 3 tabelas tenant-isoladas
(`training_catalog`, `training_records`, `job_role_required_trainings`) + enum `training_periodicity`
(`annual|biennial|triennial|quinquennial|single`). Fundação (#28) + 4 US zero-migration: US1 CRUD do
catálogo (#29); US2 registro de realização com `valid_until` calculado no servidor por
`computeValidUntil` D1 (`single→null`); US3 controle de vencimento (helper D5 último-registro +
`classifyTrainingStatus` D2, exclui `single`, resumo `{expired,dueSoon}` p/ dashboard); US4 obrigatórios
por função + conformidade (reusa D5+D2, `missing` sem registro). Certificado = `certificate_path text`
(sem GED — D4). Reusa `VALIDATION`/`DUPLICATE`/`NOT_FOUND`/`FK_NOT_FOUND`/`FORBIDDEN`; `IN_USE` (409)
ganha mapeamento HTTP em `api/rest.ts` (o código já existia, sem status). Funções puras D1/D2 em
`src/shared/domains/pgr/trainings.ts`; `todayInSaoPaulo` promovido de CAEPI p/ `src/shared/dates.ts`.
Testes: unit (D1/D2/zod) + integração em Postgres efêmero (CRUD, cross-tenant, `dependents`,
conformidade, `FORBIDDEN`).

Fatia anterior (`016` — ai-risk-suggestion, mergeada em `develop`) — **Sugestão de riscos assistida
por IA** (primeira feature que chama um LLM externo). Plan:
`.specs/016-ai-risk-suggestion/plan.md` (spec/research/data-model/contracts/quickstart no mesmo
diretório). 2 user stories: US1 (P1) botão "Sugerir Riscos com IA" no GES → contexto **não-PII** do GES
(processo/ambiente/**títulos** de função, nunca `employees`) → LLM Anthropic (`@anthropic-ai/sdk`,
saída estruturada por tool use validada por Zod, chave **server-only**) → modal de revisão/aceite →
aceitos viram **rascunho** em `risks` via `createRisk` (zero migration de risco); US2 (P2) dicas
estáticas NR-01 nos campos de GES/risco. Rate limiting por org: **migration nova
`0014_ai_usage_events`** (append-only + RLS; cota = contagem do mês corrente; free 20/mês, pro
ilimitado — espelha a cota de assinatura). Núcleo compartilhado
`server/pgr/ai-risk-suggestion-core.ts` consumido por Server Action (`officeAction`) + REST mirror
(`/api/v1/ges/[id]/risk-suggestions(/accept)`). Novo erro `AI_UNAVAILABLE` (502). Isolamento/cota
verificados **antes** do LLM (cross-tenant → `FK_NOT_FOUND` sem chamar o LLM). **Constitution Check**:
Princípio II (serviço externo pago) exige **emenda formal** — registrado em Complexity Tracking.
Testes: unit + integração (Postgres efêmero `INTEGRATION_*`, **LLM mockado**). Migration
`0015_ai_usage_events` (renumerada de `0014` no rebase).

Fatia anterior (`012`) — Branch **`feature/epi-module-completion`** — **Conclusão da Fase 02 /
módulo operacional de EPI** (issues `#18`/`#115`/`#75`, `#19`, `#20`, `#21`; `#78` fica p/ Fase 03).
Plan: `.specs/012-epi-module-completion/plan.md` (spec/research/data-model/contracts/quickstart no mesmo
diretório). 5 user stories: US1 plugar `CaField`/CAEPI no `epi-catalog-form.tsx` (wiring, zero migration);
US2 entrega + baixa transacional (extrai `applyStockExit`/`applyStockEntry` de `stock-movements.ts`, D2) +
assinatura manual inline (D1); US3 assinatura pública `/sign/[token]` (token HMAC stateless 72h, orgId
embutido → `withOrg`, +`"/sign/(.*)"` no `proxy.ts`); US4 devolução + reposição (**migration `0011`**,
renumerada de `0010` no rebase: `employee_return` no enum `stock_movement_type` + `returned_at` em
`epi_delivery_items`); US5 ficha read-only por funcionário. Assinatura é **inline**
(`epi_deliveries.auth_token`+`signature_status` da 008), NÃO a infra genérica da `010` (que já está
mergeada em `develop` via PR #127 — decisão da fatia mantida). Novos códigos de erro:
`ALREADY_SIGNED`/`ALREADY_RETURNED` (409), `TOKEN_INVALID` (404), `TOKEN_EXPIRED` (410). Base:
`develop` pós-#127 (última migration `0010_digital_signature_infra`); branches antigas
`feature/ppe-*` são só referência.

Fatia anterior (`010` — digital-signature-infra, mergeada em `develop` via PR #127) —
`.specs/010-digital-signature-infra/`: **infraestrutura de assinatura digital** (issue #67):
camada de plataforma transversal e reutilizável (DRY) para coleta de assinatura por **link
público com token + QR + captura canvas→PNG**, consumida por múltiplos módulos via **registry de
`target_type`** (consumidor #1 = `demo`).

- Plan: `.specs/010-digital-signature-infra/plan.md`

- Plan: `.specs/010-digital-signature-infra/plan.md`
- Spec / Research / Data model / Quickstart no mesmo diretório; briefing fonte da verdade em
  `docs/briefings/briefing-digital-signature-infra.md`.
- Contracts: `contracts/server-actions.md`, `contracts/repositories.md`, `contracts/public-route.md`.

Notas chave (`010`):

- **Modelagem genérica polimórfica**: `signature_requests` (pedido) + `signature_captures`
  (resultado 1:1), discriminadas por `target_type`. Novo módulo consumidor = +1 entrada no
  registry, **zero mudança de schema**. 2 `pgEnum` (`signature_request_status` `pending|signed|cancelled`;
  `signature_method` `qr|link|manual`). "expired" é **derivado na leitura**, não persistido.
  Migration nova `0010_digital_signature_infra` (GRANT + triggers + policy de capability como SQL
  custom; renumerada de `0009` no rebase — a `0009` é a `caepi_certificates` do `develop`).
- **Rota pública sem login** (`app/(public)/assinar/[token]`): isolamento vem **do token**, não do
  cliente. `signature_requests` tem 2 policies RLS PERMISSIVE: tenant (`FOR ALL`, `app.current_org`)
  - **capability** (`FOR SELECT`, `token_hash = current_setting('app.signature_token', true)`).
    Helper novo `withSignatureToken(rawToken, fn)` (espelha `withOrg`); grava via `withOrg(orgId)` após
    derivar o tenant do token.
- **Token**: ≥256 bits, persistido só **hasheado** (sha-256, `token_hash` UNIQUE); cru só vive na
  URL/QR; TTL configurável (default 72h); **uso único** (`used_at`; UPDATE atômico `WHERE used_at IS NULL`).
- **Tempo real por polling ~3s** (não SSE); **imagem base64 no Postgres** (não storage externo);
  **quota derivada** por mês corrente (não contador/cron).
- **Plano (spec 005, Inv-1)**: gate na **criação** (`createSignatureRequest`, lê `ctx.plan`);
  `pro` ilimitado, `free` = 10 pedidos/mês → `QUOTA_EXCEEDED` (REST 402). Rota pública **nunca**
  checa plano. Helpers em `src/shared/tenant/plan.ts` (`FREE_SIGNATURE_MONTHLY_QUOTA=10`).
- **Reuso**: `ActionResult`/`officeAction` (interno) + ação pública dedicada sem gate;
  `requireOfficeStaff`/`requireTenantContext`; libs novas `qrcode` (server) + `signature_pad` (vanilla).
- Testes: unit (token/expiração/quota/Zod) + integração (create, submitPublic, expirado, reuso,
  quota, signManually, **cross-tenant**) contra **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite.

Fatia paralela (`010` em `develop`) — **Movimentações de estoque e histórico**
(`.specs/010-stock-movements/`, `stock_movements`): registrar **entrada** (compra) e **saída
manual** (ajuste/descarte) de itens de estoque de EPI, mantendo o saldo materializado
**`epi_stock.balance`** por **transação atômica** (`SELECT … FOR UPDATE`), e exibir o
**histórico por item** com **saldo resultante derivado** (window function, sem coluna). Camada de
**fluxo** sobre o modelo da `008` e contrapartida da `009` (epi-stock-crud). **Zero migration.**

Notas chave (stock-movements):

- **Escrita transacional do saldo** (1ª fatia que escreve `epi_stock.balance`): por movimento,
  `SELECT … FOR UPDATE` → valida `novoSaldo >= 0` na app (`CHECK balance >= 0` como backstop) →
  `INSERT` no movimento + `UPDATE` do saldo, tudo numa transação (`withOrg`). Falha → rollback total.
- **`quantity` sempre > 0**; o sinal vem do `type` (`purchase` `+`; `adjustment`/`discard` `−`).
  Saída manual só aceita `{adjustment, discard}` (sem ajuste bidirecional).
- **Saldo resultante derivado** por window function + função pura `computeRunningBalance` (unit);
  **sem coluna `balance_after`**. **"Usuário que registrou" omitido** (modelo 008 sem `created_by`).
- **Novo erro `INSUFFICIENT_STOCK` → 422** em `src/shared/api/rest.ts`. REST em
  `/api/v1/epi-stock/[id]/movements` (POST registra; GET histórico). Rota UI `/epi-stock/[id]/history`.
- Testes: unit (`computeRunningBalance`, schemas); integração de Server Actions/REST +
  rollback de saída insuficiente + histórico + `NOT_FOUND` cross-tenant + `FORBIDDEN` contra
  **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite nem o banco de dev.

Fatia anterior (`011` — caepi-ca-validation, mergeada em `develop` via PR #132) —
`.specs/011-caepi-ca-validation/`: **Validação/consulta de CA no CAEPI/MTE** (issues `#115` +
`#75` duplicada). Tabela **GLOBAL** `caepi_certificates` (espelho da base pública do MTE, **sem
`org_id`/RLS de tenant/`withOrg`** — exceção justificada ao Princípio I; RLS ligado com policy
única de leitura global `USING (true)` por causa do event trigger `ensure_rls` de produção;
`app_runtime` = SELECT-only, escrita só pelo job via conexão owner), alimentada por
`scripts/caepi-sync.ts` (Playwright/Chromium **headed** — headless barrado pelo Cloudflare —
postback ASP.NET → `.csv.gz` com HTML ASPX anexado após o gzip → `csv-parse` streaming → upsert
idempotente por `ca`; fallback `--file`). Consulta **100% local** `lookupCa` (Server Action
`requireAuth()` + REST `GET /api/integrations/caepi/[ca]`) → contrato `CaLookupResult`
(`valid`/`expired`/`not_found` como payload 200) + hook `use-caepi-validation` + `ca-field.tsx`
(autofill fabricante/norma/validade; **nunca bloqueia** o cadastro). Regra de vigência
(`validate-ca`, pura): `valid` ⇔ situação normalizada `VALIDO` **e** `valid_until >= hoje`
(inclusivo, fuso `America/Sao_Paulo`); senão `expired`; situação desconhecida → `expired`; base
vazia → `not_found`. Repositório dividido: `repositories/caepi.ts` (leitura runtime) vs
`repositories/caepi-upsert.ts` (escrita do job, handle owner injetado). Migrations
`0008_epi_catalog_type_fk` + `0009_caepi_certificates`; devDeps do job:
`playwright` + `csv-parse`. Convive com a camada CEP/CNPJ da mesma branch.

Fatia anterior (`009` — epi-stock-crud, commit `a55d70b`): CRUD de `epi_stock` com `balance`
**read-only**; reuso de `ActionResult`/`officeAction`/`requireOfficeStaff`/`_ui`. Sem migration.

Fatia anterior (`009` — category-crud) — `.specs/009-category-crud/`. Notas chave:

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
