# Implementation Plan: Movimentações de estoque e histórico (`stock_movements`)

**Branch**: `feature/stock-movements` | **Date**: 2026-06-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/010-stock-movements/spec.md`

## Summary

Entregar o **registro de movimentações de estoque** (entrada por compra e saída manual por
ajuste/descarte) e o **histórico por item**, mantendo o **saldo materializado** `epi_stock.balance`
por **transação atômica**, e exibindo o **saldo resultante derivado** no histórico. É a camada de
**fluxo** sobre o modelo da 008 e a contrapartida da 009 (que trata `balance` como read-only).

Abordagem técnica: criar um repositório de movimentos (`stock-movements.ts`) com
`registerStockEntry`/`registerStockExit`/`listStockMovements`, todos via `withOrg()` (transação +
RLS backstop); a escrita de saldo usa **`SELECT … FOR UPDATE`** na linha do `epi_stock`, valida
`novoSaldo >= 0` na aplicação (mensagem amigável; `CHECK balance >= 0` como backstop), insere o
movimento e atualiza o saldo na **mesma transação**. O saldo resultante do histórico é **derivado**
por window function (`SUM(signed_quantity) OVER (ORDER BY movement_date, created_at)`), com uma
função pura `computeRunningBalance` espelhando a regra para teste unitário. Schemas zod
(`stockEntrySchema`/`stockExitSchema`) e DTO/mapeadores no domínio; uma Server Action por operação
via o wrapper **`officeAction`** (gate `requireOfficeStaff()`, contrato `ActionResult<T>`, auditoria
sem PII na escrita); endpoints REST em `/api/v1/epi-stock/[id]/movements` via `restHandler`; e UI
(modais de entrada/saída + tela de histórico) reusando o vertical `epi-stock` da 009.
**Novo código de erro `INSUFFICIENT_STOCK` (→ 422)** em `src/shared/api/rest.ts`. **Sem migration
nova, sem lib nova** (Princípio II): `stock_movements`/`epi_stock` e seus `CHECK`/RLS já existem na
008 (migrations `0007`/`0008`).

A novidade frente à 009 é a **escrita transacional do saldo com garantia de não-negatividade** — o
ponto técnico central e o maior risco da fatia.

## ⚠️ Pré-condições de branch e dependências (GATE de execução)

> **Bloqueio descoberto no planejamento — registrar aqui e resolver ANTES de `/speckit-tasks`/
> `/speckit-implement`.** Esta fatia depende **integralmente** da 008 (modelo `epis.ts`) e da 009
> (repo/domínio/actions/UI/REST de `epi-stock`). No estado atual do repositório:

| Item | 008 (`epis.ts`, `stock_movements`/`epi_stock`) | 009 (`epi-stock.ts` repo/actions/UI) |
| ---- | ---------------------------------------------- | ------------------------------------ |
| `develop` | ❌ ausente | ❌ ausente |
| `feature/stock-movements` (esta branch) | ❌ ausente | ❌ ausente |
| `feature/epi-stock-crud` | ✅ presente (008+009 empilhadas) | ✅ presente |

- Esta branch foi criada a partir de `develop` (merge-base `daaab18`), que **não** contém 008/009.
  Logo, `src/shared/db/schema/epis.ts`, `src/shared/db/repositories/epi-stock.ts` e os arquivos do
  vertical `epi-stock` **não existem aqui** — apenas dirs vazios `src/app/(protected)/epi-stock` e
  `src/app/api/v1/epi-stock`.
- **Ação requerida antes de implementar** (uma das opções):
  1. **Recomendado**: mergear 009 (`feature/epi-stock-crud` → `develop`) — que já carrega a 008 — e
     então **rebasear** `feature/stock-movements` sobre `develop`; ou
  2. **Empilhar**: rebasear `feature/stock-movements` diretamente sobre `feature/epi-stock-crud`
     (mantém a cadeia 008 → 009 → 010 até a 009 mergear).
- **Os artefatos de design desta fatia (spec/plan/research/data-model/contracts/quickstart) são
  válidos independentemente** — descrevem o alvo sobre 008/009. Apenas a fase de implementação fica
  bloqueada até a base estar presente.

## Technical Context

**Language/Version**: TypeScript `strict` (Next.js 16.2.6 App Router, React 19.2.4)

**Primary Dependencies**: Drizzle ORM (`postgres` driver), zod 4, Clerk (`@clerk/nextjs`), Supabase
(PostgreSQL + Storage), Tailwind CSS v4. **Sem libs novas** (KISS).

**Storage**: Supabase PostgreSQL. Schema code-first via Drizzle. Tabelas `stock_movements`/`epi_stock`,
seus `CHECK` (`quantity > 0`, `balance >= 0`) e RLS (`stock_movements_isolation`/`epi_stock_isolation`)
**já migrados na 008** (migrations `0007`/`0008`). Esta fatia **não** cria migration nova.

**Testing**: Jest + Testing Library. Projetos `unit` e `integration`. Integração de Server
Actions/REST/transação roda contra **Postgres efêmero** (`INTEGRATION_DATABASE_URL` /
`INTEGRATION_APP_RUNTIME_URL`), reusando o harness existente (`_helpers/db.ts`, `_helpers/pgr-seed.ts`,
`runIsolationSuite`). Exceção do Princípio "Stack/Testes" para recursos exclusivos do Postgres (RLS,
`CHECK`, transação com `FOR UPDATE`).

**Target Platform**: Vercel (serverless, Next.js fullstack — Server Components + Server Actions + Route
Handlers).

**Project Type**: Web app fullstack (Next.js App Router unificado).

**Performance Goals**: Registro síncrono e leve (Princípio IV) — uma transação curta por movimento.
Histórico paginado no servidor (offset, pageSize 20) para não degradar conforme os movimentos crescem
(FR-033).

**Constraints**: Isolamento multi-tenant não-negociável (tenant da sessão via `requireTenantContext()`,
nunca do cliente; RLS backstop); zod antes do banco; **saldo nunca negativo** (validação na app +
`CHECK` como backstop); **atomicidade** (movimento e saldo numa transação, serializados por
`SELECT … FOR UPDATE`).

**Scale/Scope**: 1 entidade de fluxo (`stock_movements`); 3 operações (entrada/saída/histórico); 2
modais + 1 tela de histórico + 2 endpoints REST; volume típico de movimentos de um item (dezenas a
milhares ao longo do tempo) — paginação offset é suficiente.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Status | Como o plano atende |
| --------- | ------ | ------------------- |
| I — Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL) | ✅ PASS | Todo acesso via `withOrg(tenantId, …)`; `tenantId` de `requireOfficeStaff()`/`requireTenantContext()` (sessão), nunca de input do cliente; RLS `stock_movements_isolation`/`epi_stock_isolation` (008) como backstop. Cross-tenant por id → `NOT_FOUND`/404; histórico cross-tenant → vazio; ausência de tenant bloqueada pelo gate. Testes de isolamento + transacionais em Postgres efêmero. |
| II — Stack Fixa & Simplicidade (YAGNI) | ✅ PASS | Sem nova infra; sem lib nova; paginação offset simples; reuso de `officeAction`/`ActionResult`/`requireOfficeStaff`/`restHandler` (007/009) e das tabelas/CHECK/RLS da 008. Saldo resultante derivado (sem coluna `balance_after`). **Sem migration nova.** |
| III — Entrega em Fatias Verticais | ✅ PASS | Fatia vertical independente: US1 (entrada) é o MVP; US2 (saída + saldo não-negativo) e US3 (histórico) são incrementos testáveis; US4 (isolamento) é transversal testável. |
| IV — Operações Pesadas Assíncronas | ✅ PASS | Registro é uma transação curta e síncrona; histórico é leitura paginada. Sem lote/PDF/upload. |
| V — Segurança e Integridade de Dados | ✅ PASS | TS `strict`, sem `any`; `stockEntrySchema`/`stockExitSchema` (zod) antes do banco; o Postgres é a fonte de verdade — `CHECK quantity > 0` e `CHECK balance >= 0` (008) são backstop; atomicidade (movimento+saldo) e serialização (`FOR UPDATE`); segredos só em env. |

**Gate de testes (Princípio "Fluxo/Quality Gates")**: a fatia depende de RLS/`CHECK`/transação/
`FOR UPDATE` ⇒ os testes de Server Action/REST/transação usam **Postgres efêmero** (exceção explícita
da constituição), nunca SQLite nem o banco de dev. Unitários (`computeRunningBalance`, sinal por
tipo, schemas, mapeamento de erro) seguem o default. `npm run lint` + tipos + `npm run test` +
`npm run test:integration` MUST passar antes de concluir.

**Resultado**: PASS, sem violações de constituição. _Complexity Tracking_ vazio. (O único gate aberto
é a **pré-condição de branch** acima — operacional, não constitucional.)

## Project Structure

### Documentation (this feature)

```text
.specs/010-stock-movements/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões técnicas (transação, window function, erro novo)
├── data-model.md        # Phase 1 — entidades 008 (ref.) + DTOs/inputs/derivação desta fatia
├── quickstart.md        # Phase 1 — como rodar/testar a fatia
├── contracts/           # Phase 1 — contratos
│   ├── server-actions.md
│   ├── repositories.md
│   └── rest-endpoints.md
├── checklists/
│   └── requirements.md  # (gerado no /speckit-specify)
└── tasks.md             # Phase 2 — gerado pelo /speckit-tasks (NÃO por este comando)
```

### Source Code (repository root)

> Caminhos **alvo** (existem após a base 008/009 estar presente — ver gate de pré-condição).

```text
src/
├── app/(protected)/
│   └── epi-stock/                          # vertical da 009 (ESTENDER)
│       ├── [id]/history/page.tsx           # NOVO — histórico (Server Component): tabela + saldo resultante + paginação
│       └── _components/
│           ├── register-entry.tsx          # NOVO — Client Component (modal entrada) → registerStockEntryAction
│           └── register-exit.tsx           # NOVO — Client Component (modal saída) → registerStockExitAction
├── app/api/v1/
│   └── epi-stock/[id]/movements/route.ts   # NOVO — POST (registrar) + GET (histórico) via restHandler
├── shared/
│   ├── server/actions/pgr/
│   │   └── stock-movements.ts              # NOVO — registerStockEntry/Exit + listStockMovements via officeAction
│   ├── domains/pgr/
│   │   └── stock-movements.ts              # NOVO — stockEntrySchema/stockExitSchema (zod) + DTOs/mapeadores + computeRunningBalance + rótulos pt-BR
│   ├── db/repositories/
│   │   └── stock-movements.ts              # NOVO — registerStockEntry/registerStockExit (transação + FOR UPDATE) + listStockMovements (window function)
│   └── api/
│       └── rest.ts                         # ESTENDER — adicionar INSUFFICIENT_STOCK → 422 ao HTTP_BY_CODE
└── __tests__/
    ├── unit/domains/pgr/
    │   └── stock-movements.test.ts         # NOVO — computeRunningBalance; sinal por tipo; schemas zod
    └── integration/
        ├── _helpers/pgr-seed.ts            # REUSO/ESTENDER — itens de estoque em org_a/org_b
        └── pgr/
            └── stock-movements.test.ts     # NOVO — entrada/saída/rollback/histórico/404 cross-tenant/FORBIDDEN (Postgres efêmero)
```

**Structure Decision**: Mesma convenção dos verticais do PGR (007/009). O repositório de movimentos é
**novo** (`src/shared/db/repositories/stock-movements.ts`) e concentra a transação atômica e a query do
histórico (Repository pattern — actions não tocam o ORM direto). Domínio (zod + DTO + `computeRunningBalance`
+ rótulos) em `src/shared/domains/pgr/stock-movements.ts`. Server Actions via `officeAction`; REST via
`restHandler` no padrão `epi-stock`. A UI **estende** o vertical `epi-stock` da 009 (modais na tela
existente + nova rota `[id]/history`). `src/shared/api/rest.ts` ganha o código `INSUFFICIENT_STOCK`.

## Complexity Tracking

> Sem violações de constituição. Nada a justificar. O risco técnico (saldo negativo/concorrência) é
> mitigado por desenho (transação + `FOR UPDATE` + `CHECK` backstop), não por exceção arquitetural.
