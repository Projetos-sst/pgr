# Implementation Plan: Cadastros base do PGR — fundação de dados (Empresa → Funcionário)

**Branch**: `feature/cadastros-base-pgr` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/006-cadastros-base-pgr/spec.md`

## Summary

Primeira fatia de **dados de domínio** do PGR. Modela e migra as **7 tabelas base** da
cadeia **Empresa → Unidade de Obra → GES → Função / Funcionário**, estendendo `companies`
(ALTER) e criando `work_units`, `ges`, `job_roles`, `categories`, `employees` e a junção
`ges_job_roles`. Cada tabela nova herda — sem mudar o motor — o padrão de isolamento da
`004`/`005`: `org_id text NOT NULL → orgs.id` indexado, RLS `app_runtime` via
`current_setting('app.current_org', true)` (`withOrg` + `set_config`), GRANT explícito.
Constraints de integridade entram **no banco** (Princípio V): FKs com `ON DELETE`
previsível, `UNIQUE(org_id, …)`, 4 enums fechados (`category_type`, `employee_sex`,
`marital_status`, `employee_status`) e CHECKs (`risk_grade ∈ 1..4`, `worker_count > 0`). O
**nº de trabalhadores expostos por GES** é **derivado** por agregação na leitura
(`SUM(worker_count)` de `ges_job_roles`), sem coluna nem trigger.

Entrega implementável: **(1)** schemas Drizzle (um arquivo por tabela, re-exportados pelo
index); **(2)** migration `0005_*` (Drizzle Kit + SQL custom para GRANT e triggers
`set_updated_at`) aplicável sem erro; **(3)** repositórios escopados por `org_id`,
incluindo a query de agregação do nº de expostos; **(4)** schemas zod de validação de
domínio; **(5)** testes unitários (validação/agregação) + integração de RLS/integridade
contra **Postgres efêmero**. Reaproveita 100% do motor existente (`withOrg`, `roles.ts`,
`tenant_probe`/`companies` como padrão canônico, harness `_helpers/db`). **Sem infra nova.
Fora desta fatia**: UI/formulários, lookup de CNPJ, ViaCEP, upload de arquivos, tabela de
CBO, vínculo com treinamentos e Server Actions de CRUD com interface (ver spec §Out of
Scope).

## Technical Context

**Language/Version**: TypeScript 5 (`strict`); Next.js 16.2.6 (App Router); React 19.2.4.

**Primary Dependencies**: `drizzle-orm` ^0.45.2 (`pg-core`: `pgTable`, `pgEnum`,
`pgPolicy`, `check`, `uniqueIndex`, `index`); `drizzle-kit` ^0.31.10 (dono code-first;
gera a migration `0005_*`); `postgres` ^3.4.9 (postgres-js; runtime como `app_runtime`);
`zod` ^4 (validação de domínio de entrada). **Não** entram dependências novas.

**Storage**: Supabase PostgreSQL. Runtime conecta via Supavisor **transaction pooler**
(6543) como `app_runtime` (sujeito a RLS); `drizzle-kit` usa conexão **direta/unpooled**
(`DATABASE_URL_UNPOOLED`) como owner para gerar/aplicar migration (ver `drizzle.config.ts`).

**Testing**: Jest 30 + `@swc/jest`. Projeto `unit` (jsdom) para validação/agregação em
mock; projeto `integration` (node) para RLS/integridade contra **Postgres efêmero** via
`INTEGRATION_DATABASE_URL` / `INTEGRATION_APP_RUNTIME_URL` / `INTEGRATION_DATABASE_URL_ADMIN`
(`describe.skip` quando ausente). Harness existente reutilizado: `_helpers/db`
(`adminClient`, `applyMigrations`, `withOrgTx`) — mesmo padrão de `companies-isolation.test.ts`.

**Target Platform**: Vercel serverless (Node runtime).

**Project Type**: Web — Next.js fullstack, projeto único, layout `src/` (herdado da `003`).

**Performance Goals**: Sem alvo específico (fatia de modelo/dados). O nº de expostos é uma
agregação `GROUP BY ges_id` sobre `ges_job_roles` filtrada por `org_id` (índices em
`org_id` e `ges_id` cobrem o acesso); custo desprezível no volume MVP.

**Constraints**: Toda leitura/escrita escopada pelo **tenant ativo** resolvido de
`requireTenantContext()` (sessão → `org_memberships`), nunca de input do cliente nem de
`session.orgId`. Fixação do tenant por transação (`set_config('app.current_org', $1, true)`,
parametrizado, compatível com pooler). RLS, policies, GRANTs e triggers entram **via
migration** (GRANT/trigger como SQL custom, padrão `0003`/`0001`) — nunca manualmente.
Constraints de dados no banco (FK/NOT NULL/UNIQUE/CHECK/enum), Princípio V.

**Scale/Scope**: Multi-tenant de alto volume e baixo ticket (profissionais solo). Esta
fatia entrega schema + migration + repositórios + validação de domínio; CRUD com UI,
uploads e demais módulos vêm depois.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio                                       | Avaliação                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL)** | ✅ É o objeto central. Cada uma das 6 tabelas novas + `companies` carrega `org_id text NOT NULL → orgs.id` indexado, RLS habilitado e policy `<t>_isolation` `FOR ALL TO app_runtime` (`org_id = current_setting('app.current_org', true)` em `USING`/`WITH CHECK`), GRANT explícito — réplica fiel de `tenant_probe`/`companies`. Acesso só por `app_runtime` (não owner). Empresa-cliente (`company_id`) é **dimensão** dentro do tenant, nunca fronteira. Conforme constituição v1.2.1 (Modelo B). |
| **II. Stack Fixa e Simplicidade (YAGNI)**       | ✅ Zero infra nova. Nº de expostos **derivado** (agregação na leitura) — sem coluna denormalizada, sem trigger de recálculo (KISS/DRY). Endereço como colunas inline (sem tabela `addresses` especulativa). Apenas os campos `*_path` entram (upload é futuro). Campos deferidos (CNH, passaporte, contatos de emergência, CBO de referência, treinamentos) ficam fora.                                                                                                                               |
| **III. Entrega em Fatias Verticais**            | ✅ Fatia coesa de fundação de dados, testável isoladamente contra Postgres efêmero. P1 (isolamento por tabela + integridade) é o núcleo; P2 (nº de expostos) e P3 (migration/padrões) completam. Fixa o precedente de nomes/padrões para o PGR.                                                                                                                                                                                                                                                       |
| **IV. Operações Pesadas Assíncronas**           | ✅ N/A — sem operação pesada. CRUD/agregação são síncronos e rápidos.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **V. Segurança e Integridade de Dados**         | ✅ TS `strict`, sem `any`. Constraints no banco como fonte de verdade: FKs com `ON DELETE` previsível, `UNIQUE(org_id, cpf)` / `UNIQUE(org_id, ges_id, job_role_id)` / `UNIQUE(org_id, company_id, title)` / `UNIQUE(org_id, type, name)`, enums fechados, `CHECK (risk_grade between 1 and 4)`, `CHECK (worker_count > 0)`. Validação zod de domínio complementa (não substitui) o banco. Sem segredos em código; logs de fronteira sem PII (`logTenantEvent`).                                      |

**Resultado**: PASS — sem violações. **Complexity Tracking** vazio. Nenhuma emenda à
constituição é necessária (a v1.2.1 já reflete o Modelo B que esta fatia consome).

## Project Structure

### Documentation (this feature)

```text
.specs/006-cadastros-base-pgr/
├── plan.md              # Este arquivo
├── spec.md              # Especificação (+ Clarifications 2026-06-19)
├── research.md          # Phase 0 — decisões técnicas (derivação, enums, ON DELETE, endereço, migration)
├── data-model.md        # Phase 1 — as 7 entidades (colunas, tipos, constraints, RLS)
├── quickstart.md        # Phase 1 — gerar/aplicar a migration e rodar os testes
├── contracts/
│   ├── schema-and-migrations.md       # Schema Drizzle + enums + RLS + GRANT + triggers + migration 0005
│   └── repositories-and-validation.md # Repositórios org-scoped + agregação do nº de expostos + zod
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── domains/
│   │   └── pgr/
│   │       └── validation.ts            # NOVO — zod de domínio (enums, risk_grade, worker_count, cpf/cnpj)
│   └── db/
│       ├── with-org.ts                  # reutilizado (withOrg)
│       ├── roles.ts                     # reutilizado (appRuntimeRole)
│       ├── schema/
│       │   ├── companies.ts             # ALTER — +nome_fantasia/phone/email/cnae/main_activity/
│       │   │                            #         risk_grade/logo_path/endereço/updated_at; razao_social NOT NULL
│       │   ├── work-units.ts            # NOVO — pgTable + pgPolicy GUC (.enableRLS())
│       │   ├── ges.ts                   # NOVO
│       │   ├── job-roles.ts             # NOVO
│       │   ├── categories.ts            # NOVO (+ pgEnum category_type)
│       │   ├── employees.ts             # NOVO (+ pgEnum employee_sex/marital_status/employee_status)
│       │   ├── ges-job-roles.ts         # NOVO (junção)
│       │   └── index.ts                 # +export das 6 novas tabelas/tipos
│       ├── migrations/
│       │   └── 0005_*.sql               # gerada por drizzle-kit (+GRANT e triggers set_updated_at custom)
│       └── repositories/
│           ├── work-units.ts            # NOVO — CRUD org-scoped (withOrg)
│           ├── ges.ts                   # NOVO — CRUD + countExposedWorkersByGes (agregação)
│           ├── job-roles.ts             # NOVO
│           ├── categories.ts            # NOVO
│           ├── employees.ts             # NOVO
│           └── ges-job-roles.ts         # NOVO
└── __tests__/
    ├── unit/
    │   └── domains/pgr/
    │       ├── validation.test.ts       # NOVO — zod: enums, risk_grade 1..4, worker_count > 0
    │       └── exposed-workers.test.ts  # NOVO — agregação: 0 sem associações; soma; reflete alteração
    └── integration/
        └── shared/db/
            ├── work-units-isolation.test.ts   # NOVO — RLS A/B, sem tenant vazio, write cross rejeitada
            ├── ges-isolation.test.ts          # NOVO
            ├── job-roles-isolation.test.ts    # NOVO
            ├── categories-isolation.test.ts   # NOVO
            ├── employees-isolation.test.ts    # NOVO — RLS A/B
            ├── ges-job-roles-isolation.test.ts# NOVO — RLS A/B
            ├── pgr-chain-integrity.test.ts    # NOVO — FK ao longo da cadeia + ON DELETE cascade/set null
            ├── pgr-constraints.test.ts        # NOVO — UNIQUE(cpf/ges_role/title/type_name) + CHECK + enum
            ├── migration-shape.test.ts        # NOVO — introspecção: RLS/policy/GRANT/trigger/enum/CHECK
            └── exposed-workers.test.ts        # NOVO — nº de expostos = SUM em Postgres real
```

**Structure Decision**: Projeto único Next.js fullstack, layout `src/`. As entidades são
schema-as-code em `src/shared/db/schema/` (um arquivo por tabela, `kebab-case`,
re-exportados pelo `index.ts`); o acesso fica em `src/shared/db/repositories/` (services
não tocam o ORM direto — padrão Repository do `CODE_STANDARDS.md`); a validação de domínio
(zod) acompanha os repositórios/domínio PGR. Os testes seguem a separação
`unit`/`integration` já existente, e os de RLS replicam `companies-isolation.test.ts`.
Nomes de arquivo/símbolo definitivos podem ser refinados no `/speckit-tasks`; a fronteira
importa: **schema + migration** (db/schema, db/migrations), **acesso/agregação**
(db/repositories) e **validação** (zod de domínio).

## Complexity Tracking

> Sem violações constitucionais — seção não aplicável.
