# Implementation Plan: Entrega de EPI com assinatura digital

**Branch**: `feature/ppe-delivery-with-signature` | **Date**: 2026-06-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/011-ppe-delivery-with-signature/spec.md`

## Summary

Fluxo de entrega de EPI a um funcionário com comprovação por assinatura digital (QR Code, link remoto
ou assinatura manual) e **baixa transacional de estoque** na confirmação. É o "#19" que a fatia 010
deixou fora de escopo: gera o movimento `employee_delivery` e decrementa `epi_stock.balance`.

Abordagem técnica (decisões já clarificadas):

- **Criar pendente, baixar na confirmação** (FR-016): a entrega nasce `pending` com itens e token,
  validando disponibilidade **sem** mexer no saldo; a baixa (1 movimento `employee_delivery` por item
  + `UPDATE balance`) ocorre **na confirmação**, numa única transação `withOrg`, reusando o padrão
  `SELECT … FOR UPDATE` + `InsufficientStockError` da 010. Rollback total se algum item faltar saldo.
- **Token de capacidade** de alta entropia, **uso único**, com **expiração derivada de `created_at` +
  janela fixa de 72h** (FR-017) — **zero migration**.
- **Rota pública sem Clerk** (`/epi-deliveries/sign/[token]`): primeiro caminho de escrita não
  autenticado; tenant **derivado do token** (server-side), nunca da sessão/input. Liberada no
  `src/proxy.ts`.
- **"Enviar Link"** (FR-018): no MVP apenas **gera/exibe** o link (sem provider de e-mail/SMS).
- Tempo real por **polling** (~5s) do `signature_status`.

## Technical Context

**Language/Version**: TypeScript `strict` (Next.js 16.2.6, React 19.2.4)

**Primary Dependencies**: Next.js App Router, Drizzle ORM, Clerk (auth, só no caminho interno), zod v4,
`@supabase/supabase-js` (já nas deps; Realtime é opcional/fora do MVP), gerador de QR (a confirmar na
pesquisa — ver research.md)

**Storage**: Supabase PostgreSQL via Drizzle. Runtime conecta como `app_runtime` (pooler 6543, RLS
ativo); **zero migration** nesta fatia (modelo 008 já tem `epi_deliveries`, `epi_delivery_items`,
`stock_movements.employee_delivery`, `epi_stock`).

**Testing**: Jest + Testing Library. Unit (`npm run test`) para lógica pura/schemas; integração
(`npm run test:integration`) contra **Postgres efêmero** (`INTEGRATION_*`) — obrigatório aqui porque o
comportamento depende de RLS, `CHECK`, transação `FOR UPDATE` e do caminho público cross-tenant. Nunca
SQLite, nunca o banco de dev (suítes fazem `TRUNCATE`).

**Target Platform**: Vercel serverless (Next.js fullstack: Server Actions + Route Handlers).

**Project Type**: Web application (Next.js unificado — sem backend separado).

**Performance Goals**: fluxo seleção→revisão→QR em < 2 min (SC-001); confirmação é CRUD transacional
síncrono (rápido) — não se enquadra em "operação pesada" do Princípio IV.

**Constraints**: saldo nunca negativo (`CHECK balance >= 0` backstop); isolamento multi-tenant
inviolável nos dois caminhos (interno e público); zero migration (salvo se uma decisão futura reabrir
expiração com coluna — não é o caso).

**Scale/Scope**: 3 user stories; ~1 repositório novo, ~1 módulo de domínio, Server Actions internas +
endpoint público, 1 wizard (3 passos) + 1 página pública.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Status | Como o plano atende |
| --------- | ------ | ------------------- |
| **I. Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL)** | ✅ PASS | Caminho interno: tenant da sessão via `requireTenantContext()` + `withOrg`; RLS backstop. Caminho público: tenant **derivado do token** server-side, nunca de input; testes de isolamento dedicados para os dois caminhos (o público é o crítico). Nunca expõe `organization_id`. |
| **II. Stack Fixa & YAGNI** | ✅ PASS | Sem nova infra. Polling (não Realtime), "Enviar Link" só gera link (sem provider), expiração derivada (sem coluna). Possível dependência leve de geração de QR — avaliar lib mínima na research; nada de microserviço/fila. |
| **III. Fatias Verticais** | ✅ PASS | Fatia única demonstrável; MVP = US1 (entrega + assinatura manual + baixa). US2 (QR/pública) e US3 (manual) incrementais e testáveis isoladamente. |
| **IV. Operações Pesadas Assíncronas** | ✅ PASS | Confirmação é CRUD transacional rápido (síncrono ok). Nenhum lote/PDF em massa nesta fatia (impressão de ficha, se entrar, é geração simples client-side). |
| **V. Segurança & Integridade** | ✅ PASS | `strict` mantido; zod antes da regra em toda action/handler (incl. público); Postgres é fonte de verdade (`CHECK`, FKs, UNIQUE parcial do token); segredos só em env. Token forte (crypto) + uso único + expiração. |

**Quality Gates**: `npm run lint` + `tsc --noEmit` verdes; `npm run test` + `npm run test:integration`
(Postgres efêmero) verdes antes de concluir. Trabalho em feature branch (já em `feature/ppe-delivery-with-signature`).

**Resultado**: PASS — sem violações; **Complexity Tracking não se aplica**.

## Project Structure

### Documentation (this feature)

```text
.specs/011-ppe-delivery-with-signature/
├── plan.md              # Este arquivo (/speckit-plan)
├── spec.md              # /speckit-specify (+ Clarifications)
├── research.md          # Phase 0 (/speckit-plan)
├── data-model.md        # Phase 1 (/speckit-plan)
├── quickstart.md        # Phase 1 (/speckit-plan)
├── contracts/           # Phase 1 (/speckit-plan)
│   ├── repositories.md
│   ├── server-actions.md
│   └── rest-endpoints.md
├── checklists/
│   └── requirements.md  # /speckit-specify
└── tasks.md             # /speckit-tasks (NÃO criado pelo plan)
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── domains/pgr/
│   │   └── epi-deliveries.ts          # zod schemas, DTOs, funções puras (estado da assinatura, token, expiração 72h)
│   ├── db/
│   │   ├── repositories/
│   │   │   └── epi-deliveries.ts      # createDelivery, signDeliveryManual, getDelivery(Status), getDeliveryByToken, confirmDeliveryByToken
│   │   └── repositories/stock-movements.ts  # refator: extrair helper de baixa reutilizável (employee_delivery)
│   ├── server/actions/pgr/
│   │   └── epi-deliveries.ts          # officeAction (interno): criar, assinar manual, status/visualizar
│   ├── api/rest.ts                    # +códigos novos do token (ALREADY_SIGNED/TOKEN_EXPIRED) no HTTP_BY_CODE
│   └── errors/                        # +AlreadySignedError / TokenExpiredError (estendendo AppError)
├── proxy.ts                           # liberar /epi-deliveries/sign/(.*) + endpoint público no createRouteMatcher
└── app/
    ├── (protected)/employees/[id]/epi-delivery/   # Passo 1 (seleção) + modais de revisão/autenticação
    ├── (protected)/_ui/{form,list}.tsx            # primitives reutilizados
    ├── epi-deliveries/sign/[token]/               # PÁGINA PÚBLICA (fora de (protected), sem sidebar)
    └── api/
        ├── v1/epi-deliveries/                     # REST interno (POST criar; [id]/sign-manual; [id]/status)
        └── public/epi-deliveries/[token]/         # endpoint público de confirmação (sem Clerk)

src/__tests__/
├── unit/domains/pgr/epi-deliveries.test.ts        # schemas, helper de baixa, máquina de estados, token/expiração
└── integration/pgr/epi-deliveries.test.ts         # actions internas + rota pública + isolamento (Postgres efêmero)
```

**Structure Decision**: Web application unificado no Next.js (Princípio II/Restrições). Reusa a
estrutura real do projeto (`src/shared/domains/pgr`, `src/shared/db/repositories`,
`src/shared/server/actions/pgr`, `src/app/(protected)`, `src/app/api/v1`), espelhando os padrões das
fatias 009/010. A novidade estrutural é a **página/endpoint públicos fora de `(protected)`** e a
edição do `src/proxy.ts` para liberá-los.

## Complexity Tracking

> Não aplicável — Constitution Check passou sem violações.
