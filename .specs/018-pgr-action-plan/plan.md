# Implementation Plan: Medidas de controle e plano de ação do risco (5W2H)

**Branch**: `feature/pgr-action-plan` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/018-pgr-action-plan/spec.md`

## Summary

CRUD do plano de ação **5W2H** por risco, sobre a tabela real **`control_measures`** (migration
`0012`, já aplicada) — **zero migration**. Uma medida por **nível NR-01** (`control_level`), no
máximo 4 por risco; a **UNIQUE `(org_id, risk_id, control_level)`** torna a duplicidade de nível um
erro real → **`DUPLICATE` / 409** (mapeado automaticamente de SQLSTATE 23505 por `toActionError`).
Campos mínimos (`action_what`/`action_how` obrigatórios quando `applicable=true`) via Zod. Estados
(`Sem plano`/`Planejada`/`Vencida`) e "vencida" são **derivados** (sem coluna de status).
Responsável é **texto** (combobox de funcionários grava `fullName`; sem FK). Contexto do risco e a
**avaliação vigente** (`riskLevel`/`result`) são exibidos **derivados** (sem snapshot). Espelha a
fatia `risk-assessment` (016): Domain → Repository (`withOrg` + `assertRiskInTenant`) → Server
Actions (`officeAction`→`ActionResult`) → REST (`restHandler`) → UI, + docs/api + Postman + testes.

## Technical Context

**Language/Version**: TypeScript strict; Next.js 16.2.6 App Router; React 19.2.4; Node runtime.

**Primary Dependencies**: Drizzle ORM + postgres-js (Supabase Postgres), Zod v4, Clerk (auth),
Tailwind v4. Sem novas dependências.

**Storage**: Postgres (Supabase). Tabela **existente** `control_measures` (migration `0012`). RLS
`app_runtime` já ativa. **Nenhuma migration nova; nenhuma alteração de schema.**

**Testing**: Jest — unit (`--selectProjects unit`, jsdom) + integração (`--selectProjects
integration`, node) contra **Postgres efêmero** via `INTEGRATION_*`. Validação REST por cURL contra
dev server (harness REST-via-Jest tem limitação pré-existente conhecida). Playwright MCP previsto.

**Target Platform**: Web (SSR/App Router) + REST `/api/v1/*`.

**Project Type**: Web app multi-tenant (SST SaaS).

**Performance Goals**: interações CRUD sub-segundo; listagem paginada (máx. 4 linhas por risco na
prática). Sem metas especiais.

**Constraints**: isolamento multi-tenant é invariante central (`withOrg` + RLS). Tenant sempre da
sessão; nunca do client. Zero migration. `action_responsible` texto (sem FK). Sem status
persistido. `CLAUDE.md` é **dívida conhecida** de formatação (tratar só nos gates finais da fatia).

**Scale/Scope**: 1 domínio + 1 repositório + 1 grupo de Server Actions (5–6) + 2 route handlers
REST + 3 páginas UI + componentes + docs/Postman + unit & integração.

## Constitution Check

_GATE — reavaliado após o design (Phase 1)._

| Princípio (constituição) | Situação nesta fatia |
| --- | --- |
| **I — Isolamento multi-tenant** | ✅ `withOrg(orgId)` + RLS `app_runtime` em `control_measures`; toda query filtra `controlMeasures.orgId`; tenant de `requireOfficeStaff()`/contexto, nunca do client. |
| **II — Serviço externo pago / emenda formal** | ✅ N/A — sem LLM/serviço externo pago. |
| **Camadas (page→action→domain→repo→drizzle)** | ✅ Repositório é o único a tocar Drizzle; actions/handlers reusam repo/zod. |
| **Superfície de API (Action + REST + docs + Postman)** | ✅ As 4 entregas planejadas juntas. |
| **Testabilidade (unit + integração Postgres efêmero)** | ✅ Unit (domínio puro) + integração (actions/REST/RLS) contra `INTEGRATION_*`. |
| **Zero migration / schema code-first** | ✅ Tabela e enum já existem (0012); nada em `schema/**` ou `migrations/**`. |

**Resultado do gate**: PASS (sem violações; Complexity Tracking vazio).

## Project Structure

### Documentation (this feature)

```text
.specs/018-pgr-action-plan/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões técnicas (D1..D12)
├── data-model.md        # Phase 1 — colunas reais, projeções, estados derivados
├── quickstart.md        # Phase 1 — cURL + Playwright + Postgres efêmero
├── contracts/
│   ├── repositories.md
│   ├── server-actions.md
│   └── rest-endpoints.md
├── checklists/
│   └── requirements.md  # (do /speckit-specify)
└── tasks.md             # (Phase 2 — /speckit-tasks; NÃO criado aqui)
```

### Source Code (repository root)

```text
src/shared/domains/pgr/
└── control-measure.ts                 # NOVO — Zod input + estados derivados + labels (reusa controlLevel de risks.ts)

src/shared/db/repositories/
└── control-measures.ts                # NOVO — withOrg + assertRiskInTenant + CRUD (DUPLICATE via 23505)

src/shared/server/actions/pgr/
└── control-measures.ts                # NOVO — officeAction → ActionResult (list/get/create/update/delete[/context])

src/app/api/v1/
├── risks/[id]/control-measures/route.ts     # NOVO — GET list + POST create (201)
└── control-measures/[id]/route.ts           # NOVO — GET + PUT + DELETE (204)

src/app/(protected)/risks/[id]/control-measures/
├── page.tsx                           # NOVO — lista + contexto + avaliação vigente
├── new/page.tsx                       # NOVO — criar
├── [measureId]/edit/page.tsx          # NOVO — editar
└── _components/                       # NOVO — form, lista/estado, delete, combobox responsável

src/app/(protected)/risks/[id]/page.tsx      # EDIT mínimo — botão "Medidas de controle"

docs/api/api-design.md                        # EDIT — recurso + verbos + erros
docs/api/sst-manager.postman_collection.json  # EDIT — pasta "Medidas de Controle"

src/__tests__/unit/domains/pgr/control-measure.test.ts             # NOVO
src/__tests__/integration/control-measures/control-measures.test.ts          # NOVO (actions)
src/__tests__/integration/control-measures/control-measures-isolation.test.ts# NOVO (RLS/cross-tenant)
src/__tests__/integration/control-measures/rest-control-measures.test.ts     # NOVO (REST)
```

**Structure Decision**: espelha 1:1 a fatia `risk-assessment` (016), já mergeada, trocando
`risk_assessments` por `control_measures` e a regra "matriz 5×5" por "5W2H por nível NR-01 +
estados derivados". Reuso máximo de infra (`officeAction`, `restHandler`, `withOrg`,
`auditedTenantWrite`, `toActionError`, `assertRiskInTenant`-pattern, `controlLevelSchema`).

## Complexity Tracking

Sem violações de constituição. Tabela vazia (nada a justificar).

## Fora do escopo (reafirmado)

Migration; alteração de schema/`migrations/**`; coluna/enum de status; FK de responsável; snapshot
de avaliação; CRUD de metodologia; alteração de `risks` além do botão; geração automática dos 4
níveis; IA/recomendação; lista aberta (múltiplas ações por nível).

## Formatação / gates finais

- `CLAUDE.md` continua **dívida conhecida** — **não** corrigir durante plan/tasks; só nos gates
  finais da fatia (ou decisão específica antes do PR).
- `format:check` final **obrigatório**; Prettier **dirigido** nos arquivos da feature; **não**
  formatar repo-wide às cegas. Ao falhar, **separar**: (a) falhas reais da feature (corrigir), (b)
  dívida `CLAUDE.md` (deixar p/ o fim), (c) ruído CRLF pré-existente (ignorar — CI-LF não acusa).
