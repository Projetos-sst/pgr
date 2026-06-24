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
