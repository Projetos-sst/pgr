# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start the dev server at http://localhost:3000
- `npm run build` — production build
- `npm run start` — serve the production build (run `build` first)
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)

- `npm run test` — testes unitários (Jest + Testing Library)
- `npm run test:integration` — testes de integração (SQLite em memória por padrão; Postgres efêmero para fatias com RLS/triggers)

**Obrigatoriedade de testes**: toda feature MUST incluir testes unitários para lógica de negócio e testes de integração para Server Actions e Route Handlers. A integração usa SQLite em memória como banco substituto **por padrão**; fatias cujo comportamento depende de RLS/policies, triggers ou `current_setting`/`auth.jwt()` MUST usar um **Postgres efêmero** (ver constituição, seção "Fluxo de Desenvolvimento & Quality Gates").

## Stack & conventions

- **Next.js 16.2.6** with the App Router (`app/` directory) and React 19.2.4. As `AGENTS.md` warns, this is a major version with breaking changes vs. older Next.js — consult `node_modules/next/dist/docs/` before writing framework code.
- **Tailwind CSS v4** — configured CSS-first. There is no `tailwind.config.*`; theme tokens live in the `@theme inline` block of `app/globals.css`, and PostCSS loads it via `@tailwindcss/postcss`.
- **TypeScript** in `strict` mode. Import alias `@/*` maps to the repo root (see `tsconfig.json`).
- Theming uses CSS custom properties (`--background`, `--foreground`) with a `prefers-color-scheme: dark` override; Tailwind `dark:` variants are used throughout components.

<!-- SPECKIT START -->

Branch: **`feature/ppe-delivery-with-signature`**. Fatia atual (`011`) — **Entrega de EPI com
assinatura digital** (`ppe-delivery-with-signature`): fluxo de entrega de EPI a um funcionário com
comprovação por **assinatura** (QR Code / link remoto / manual) e **baixa transacional de estoque** na
confirmação. É o **`#19`** que a `010` deixou fora de escopo: gera o movimento **`employee_delivery`**
e decrementa **`epi_stock.balance`**. Camada de **fluxo** sobre o modelo da `008`, reusando o
transacional da `010` (`SELECT … FOR UPDATE` + `InsufficientStockError`). **Zero migration.**

Fatia atual (`011`) — `.specs/011-ppe-delivery-with-signature/`:

- Plan: `.specs/011-ppe-delivery-with-signature/plan.md`
- Spec (+ Clarifications) / Research / Data model / Quickstart no mesmo diretório.
- Contracts: `contracts/repositories.md`, `contracts/server-actions.md`, `contracts/rest-endpoints.md`.
- Briefing (fonte): `docs/briefings/briefing-ppe-delivery-with-signature.md`.

Notas chave (`011`):

- **Decisões clarificadas**: baixa **na confirmação** (entrega nasce `pending`, sem mexer no saldo);
  token expira por **`created_at` + 72h derivado** (zero migration); "Enviar Link" **só gera/exibe**
  (sem provider de e-mail/SMS); tempo real por **polling** (~5s).
- **Baixa atômica multi-item** na confirmação: por item `SELECT … FOR UPDATE epi_stock` → revalida
  `balance - quantity >= 0` (senão `INSUFFICIENT_STOCK`/422 + **rollback total**) → `INSERT
  stock_movements(employee_delivery, delivery_id)` → `UPDATE balance`; + `signature_status → signed_*`.
  Refatorar a `010` para extrair helper de baixa reutilizável.
- **`epi_delivery_items` guarda `catalog_id`** (= `epi_stock.catalog_id`), não `stock_id`; a seleção é
  sobre `epi_stock` (itens com `balance > 0`).
- **Rota PÚBLICA sem Clerk** (`/epi-deliveries/sign/[token]` + `/api/public/epi-deliveries/*`): 1º
  caminho de escrita não autenticado — tenant **derivado do token** server-side, nunca da sessão/input;
  liberar no **`src/proxy.ts`** (sem o bypass dev). Testes de isolamento dedicados (interno **e** público).
- **Novos erros**: `ALREADY_SIGNED → 409`, `TOKEN_EXPIRED → 410` em `src/shared/api/rest.ts`
  (`INSUFFICIENT_STOCK → 422` já existe da 010). Domínio/repo/actions novos em `pgr/epi-deliveries`.
- Testes: unit (schemas, helper de baixa, máquina de estados, token/expiração); integração de actions
  + rota pública + isolamento contra **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite nem dev.

Fatia anterior (`010` — stock-movements, commit `ea0c3e8`): movimentações (entrada/saída) que
**escrevem** `epi_stock.balance` em transação `FOR UPDATE`; histórico com saldo derivado (window
function); erro `INSUFFICIENT_STOCK → 422`. Sem migration.

Fatia anterior (`009` — epi-stock-crud, commit `a55d70b`): CRUD de `epi_stock` com `balance`
**read-only**; reuso de `ActionResult`/`officeAction`/`requireOfficeStaff`/`_ui`. Sem migration.

Fatia anterior (`008` — epi-data-model) — `.specs/008-epi-data-model/`. Notas chave (`008`):

- **Reuso de `categories`** (006) como taxonomia EPI/máquina — **sem** `epi_categories`;
  `epi_catalog.category_id → categories`. **`epi_risk → ges`** de forma **interina** (não há
  tabela `risks` ainda) — dívida técnica registrada.
- **FR-002a (delta pendente)**: garantir no banco `epi_catalog.type == categories.type` via
  **FK composta** `(category_id, type) → categories(id, type)` + `UNIQUE(id, type)` em
  `categories`. Hoje o código tem FK simples; esse é o trabalho restante da fatia.
- **Constraints**: `CHECK quantity > 0` (movimentos/itens), `balance/min_quantity ≥ 0`;
  `UNIQUE(org, catalog)` estoque, `(org, catalog, ges)` risco; `auth_token` único **global**
  (índice parcial); enums fechados. Saldo **materializado** (manutenção é Fase 2).
- **ON DELETE**: `CASCADE` na cadeia de posse + `employees → epi_deliveries`; `SET NULL` em
  `stock_movements.delivery_id`; `RESTRICT` em `epi_catalog.category_id` e
  `epi_delivery_items.catalog_id` (protege taxonomia/histórico).
- **Isolamento (intacto)**: toda tabela tem `org_id → orgs.id` indexado, RLS `app_runtime`
  (`current_setting('app.current_org', true)`), GRANT; acesso via `withOrg`, tenant da sessão.
- **Migration `0007_epi_data_model`** (drizzle-kit) com GRANT + triggers `set_updated_at` como
  SQL custom (padrão `0005`), aplicada via conexão direta unpooled (owner).
- Testes: unit (zod dos enums/quantidade); constraints + forma da migration + **6 suítes de
  isolamento** contra **Postgres efêmero** (`INTEGRATION_*`/`runIsolationSuite`), nunca SQLite.

Fatia anterior (`007`) — `.specs/007-pgr-base-cruds/`: **CRUD completo** das 5 entidades da
cadeia do PGR em UI (App Router) + Server Actions sobre o modelo da `006`; contrato
`ActionResult<T>` em `src/shared/server/result.ts`; autorização por papel `requireOfficeStaff()`
(`client` → 403); paginação offset; **sem migration nova**. Testes unit + integração de Server
Actions + isolamento contra Postgres efêmero.

Fatia (`006`) — `.specs/006-cadastros-base-pgr/` (modelo de dados; migration `0005`).

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
