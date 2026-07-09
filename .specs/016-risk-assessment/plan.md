# Implementation Plan: Avaliação de Risco — Probabilidade × Severidade (matriz 5×5)

**Branch**: `feature/risk-assessment` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/016-risk-assessment/spec.md`

## Summary

Entregar a **gestão de avaliações de risco** (`risk_assessments`) — list (por risco), getById,
getCurrent (vigente), create, update, delete — em **dual-surface** (Server Actions + REST) + UI
aninhada ao risco (`/risks/[id]/assessments`, `.../new`, `.../[assessmentId]/edit`), reusando
**integralmente** o padrão da fatia de riscos (`014`) e consumindo a **metodologia 5×5** já mergeada
(`013`). A tabela `risk_assessments` já existe (migration `0012`); esta fatia é **zero-migration** e
não toca `control_measures`/`epi_risk`/`risk_methodology` (além de **ler** a metodologia) nem o CRUD
de `risks`.

Regras de negócio da fatia: **`riskId` obrigatório e tenant-scopado** (guard `assertRiskInTenant`
→ `FK_NOT_FOUND`/422); **`probability`/`severity` inteiros 1–5**, **`uncertaintyDegree` 0–2**,
**`criterion`** ∈ {`qualitative`,`quantitative`}, **`assessedAt`** data obrigatória; **`riskLevel` =
probability × severity** calculado (via `computeRiskLevel` de `domains/pgr/risks.ts`) e **persistido**
(o banco só valida via CHECK de coerência); **`result` persistido como snapshot** da classificação
(via `classify(riskLevel, bands)` da metodologia da org, com **fallback padrão**); **histórico 1:N**
(sem UNIQUE → **sem 409**, sem upsert; vigente = última por `assessedAt desc`, `createdAt desc`);
**update corpo completo** (mesmo schema do create, sem tocar `risk_id`); isolamento por `withOrg` +
RLS; `NOT_FOUND` (404) cross-tenant; tenant sempre da sessão.

Abordagem técnica (derivada de `research.md`): o domínio novo `domains/pgr/risk-assessment.ts`
importa `assessmentCriterionSchema`/`assessmentCriterionLabel`/`uncertaintyDegreeLabel`/
`computeRiskLevel` de `./risks` e `classify`/`riskClassificationLabel`/`RiskClassification` de
`./methodology`; expõe `riskAssessmentInputSchema` (com **coerção** string→número nos campos
numéricos, para servir REST-JSON e form) e a **função pura** `deriveAssessmentResult(values, bands)`
→ `{ riskLevel, result }` (coração unit-testável). O repositório copia o guard tenant-scopado
(padrão `assertGesInTenant`) apontando para `risks`; **cada superfície** (Action e REST) lê a
metodologia via `getRiskMethodologyView` e chama `deriveAssessmentResult` **antes** de persistir —
o repositório recebe `riskLevel`/`result` já computados (single write path, regra não
re-implementada). A UI reusa `_ui/list`, `_ui/form` e `ConfirmDeleteButton`; o formulário faz
**preview em tempo real** de `riskLevel`/classificação no cliente (recebe as `classificationBands`
como prop do server). Testes contra Postgres efêmero (`INTEGRATION_*`), com `pgr-seed.ts` que **já
contém** `risk_assessments` por tenant (`riskAssessmentA`/`riskAssessmentB`).

## Technical Context

**Language/Version**: TypeScript strict (Next.js 16.2.6 App Router, React 19.2.4)

**Primary Dependencies**: Drizzle ORM + `postgres` (postgres-js) sobre Supabase Postgres; Zod v4;
Clerk (auth de sessão); Tailwind v4. **Sem novas dependências.**

**Storage**: Postgres (Supabase). Tabelas `risk_assessments` + `risks` + `risk_methodology`
(migrations `0012`/`0013`), lidas via runtime `app_runtime` (pooler 6543) com RLS; `drizzle-kit`/
owner **não** é usado (zero-migration).

**Testing**: Jest — projeto `unit` (jsdom) e projeto `integration` (node). Integração contra
**Postgres efêmero** via `INTEGRATION_DATABASE_URL` (admin) + `INTEGRATION_APP_RUNTIME_URL` (role
`app_runtime`, RLS real). Validação manual: Playwright MCP (UI) + cURL (REST).

**Target Platform**: Vercel serverless (Next.js fullstack). Sem API separada.

**Project Type**: Web application (Next.js fullstack, single repo).

**Performance Goals**: CRUD síncrono (Princípio IV — nada pesado/assíncrono). Listagem paginada
(pageSize 20, máx 100); leitura da metodologia é 1 linha singleton por org (sem N+1). Preview de
classificação é **client-side puro** (sem round-trip por tecla).

**Constraints**: Zero-migration; tenant sempre da sessão; Drizzle só em repositório; `any` proibido
sem justificativa; escopo restrito às colunas de `risk_assessments`.

**Scale/Scope**: 1 entidade (`risk_assessments`) · 6 operações (incl. `getCurrent`) · 2 superfícies
(Actions + REST) · 3 rotas de UI (aninhadas) + botão no detalhe do risco · ~11 arquivos de produto +
~4 de teste + docs/Postman. MVP = US1 (criar+classificar) + US2 (histórico). US3
(reavaliar/editar/excluir) incrementa sem bloquear.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Constituição v1.2.1 — conformidade por princípio:

- **I. Isolamento Multi-Tenant (NÃO-NEGOCIÁVEL)** ✅ — toda query via `withOrg(orgId, …)` +
  `eq(riskAssessments.orgId, orgId)`; tenant de `requireOfficeStaff()`/bypass dev (nunca de input do
  cliente); RLS `risk_assessments_isolation` (`app_runtime`) como backstop, provada por
  `risk-assessments-isolation.test.ts` contra Postgres efêmero (não SQLite). `risk_id` é dimensão
  DENTRO do tenant, validada por `assertRiskInTenant` tenant-scopado.
- **II. Stack Fixa e YAGNI** ✅ — nenhuma infra/dependência nova; implementa só o requisito da
  fatia; **consome** a metodologia (não cria CRUD); `control_measures`/plano 5W2H/`epi_risk`/IA ficam
  fora; nenhum versionamento formal além do histórico 1:N já existente.
- **III. Entrega em Fatias Verticais** ✅ — fatia vertical (banco existente → domain → repo →
  action/REST → UI), testável isolada; MVP = US1/US2 antes de US3.
- **IV. Operações Pesadas Assíncronas** ✅ — CRUD leve/síncrono; classificação é aritmética pura;
  nada de PDF/lote/IA.
- **V. Segurança e Integridade** ✅ — TS `strict`, sem `any`; validação Zod antes de qualquer
  escrita; Postgres é fonte de verdade (CHECKs 1–5 / 1–25 / coerência / 0–2 e RLS do `0012` como
  backstop; app calcula `riskLevel` e recusa `riskLevel` vindo do cliente); segredos só em env.
- **Quality Gates** ✅ — a fatia depende de RLS/policies ⇒ integração em **Postgres efêmero**
  (exceção explícita ao default SQLite); `npm run lint`/`typecheck`/`test`/`test:integration` +
  **`format:check`** verdes antes de concluir.

**Resultado**: PASS, sem violações. `Complexity Tracking` vazio.

## Project Structure

### Documentation (this feature)

```text
.specs/016-risk-assessment/
├── plan.md               # Este arquivo
├── research.md           # Fase 0 — decisões técnicas
├── data-model.md         # Fase 1 — entidade risk_assessments + schema Zod + projeções
├── quickstart.md         # Fase 1 — test-plan (auto + manual) + comandos reais
├── contracts/
│   ├── repositories.md   # Assinaturas do repositório risk-assessments
│   ├── server-actions.md # Assinaturas das Server Actions risk-assessments
│   └── rest-endpoints.md # Contrato REST (nested + flat)
├── checklists/
│   └── requirements.md   # (da /speckit-specify)
└── tasks.md              # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── domains/pgr/
│   │   └── risk-assessment.ts             # NOVO — riskAssessmentInputSchema, labels, deriveAssessmentResult, tipos
│   ├── db/repositories/
│   │   └── risk-assessments.ts            # NOVO — list/getById/getCurrent/create/update/delete + assertRiskInTenant
│   └── server/actions/pgr/
│       └── risk-assessments.ts            # NOVO — list/get/getCurrent/create/update/delete Actions
├── app/
│   ├── api/v1/
│   │   ├── risks/[id]/assessments/
│   │   │   └── route.ts                   # NOVO — GET (list by risk) / POST (create 201)
│   │   └── risk-assessments/[id]/
│   │       └── route.ts                   # NOVO — GET / PUT / DELETE (204)
│   └── (protected)/risks/[id]/
│       ├── page.tsx                       # EDIT — botão "Avaliações" (link p/ .../assessments)
│       └── assessments/
│           ├── page.tsx                   # NOVO — histórico + vigente + "Nova avaliação" + vazio
│           ├── new/page.tsx               # NOVO — criação (passa bands p/ preview)
│           ├── [assessmentId]/edit/page.tsx  # NOVO — edição (corpo completo)
│           └── _components/
│               ├── assessment-form.tsx    # NOVO — form criar/editar + preview riskLevel/classificação (client)
│               └── delete-assessment.tsx  # NOVO — wrapper de ConfirmDeleteButton
├── __tests__/
│   ├── unit/domains/pgr/
│   │   └── risk-assessment.test.ts        # NOVO — schema (ranges/criterion/assessedAt) + deriveAssessmentResult
│   └── integration/risk-assessments/
│       ├── risk-assessments.test.ts       # NOVO — Server Actions + Postgres efêmero
│       ├── rest-risk-assessments.test.ts  # NOVO — Route Handlers via bypass dev
│       └── risk-assessments-isolation.test.ts  # NOVO — runIsolationSuite({ table:"risk_assessments" })
└── __tests__/integration/_helpers/
    └── pgr-seed.ts                        # (já contém risk_assessments por tenant; estender só se necessário)

docs/api/
├── api-design.md                          # EDIT — seção "Avaliações de Risco" + linhas nas tabelas
└── sst-manager.postman_collection.json    # EDIT — pasta "Avaliações de Risco" + variável riskAssessmentId
```

**Structure Decision**: Web application Next.js fullstack (camadas
page/handler → action → domain → repository → Drizzle), exatamente como as fatias 007/009/013/014.
UI **aninhada** sob `app/(protected)/risks/[id]/assessments/**` (decisão de rota aprovada); REST em
duas superfícies (`api/v1/risks/[id]/assessments/**` p/ list+create; `api/v1/risk-assessments/[id]`
p/ get/put/delete). Nenhuma alteração em `schema/**` ou `migrations/**`. Única edição em arquivo
existente: `risks/[id]/page.tsx` (botão de acesso) — nenhuma mudança no CRUD de `risks`.

> **Nota de nomenclatura**: o domínio novo é `domains/pgr/risk-assessment.ts` (singular) e importa
> enums/labels/matriz de `domains/pgr/risks.ts` e `domains/pgr/methodology.ts` (plural). Repositório
> `repositories/risk-assessments.ts`, actions `actions/pgr/risk-assessments.ts`, UI aninhada — sem
> colisão.

## Complexity Tracking

> Sem violações da constituição — seção vazia.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |
