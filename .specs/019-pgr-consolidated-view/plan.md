# Implementation Plan: Editor do PGR (abas) e visão consolidada

**Branch**: `feature/pgr-consolidated-view` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/019-pgr-consolidated-view/spec.md`

## Summary

Transforma `/pgr/[id]` num **editor com abas client-side** e adiciona uma **visão consolidada**
read-only do PGR. **Zero-migration** sobre tabelas já existentes (migration `0012`): `pgr`
(documento — CRUD já entregue na 013, reutilizado), **`pgr_ges`** (vínculo PGR↔GES — ganha
repo/actions/REST/UI), **`pgr_revisions`** (revisões append-only — ganha repo/actions/REST/UI). A
consolidada compõe, em **repository read-only dedicado**, `pgr` → `pgr_ges` → `ges` → `risks` →
**avaliação vigente** (`getCurrentRiskAssessment`) → **`control_measures`** com **estado derivado**
(`deriveMeasureState`, Feature 018), ordenando riscos por **`risk_level` desc** (sem avaliação por
último). GED e Cor/Sumário ficam como **placeholder desabilitado** (Fase 05). Espelha o padrão de
associação da fatia `epi-risk` (`risks/[id]/epis`) e o de leitura/composição das fatias de risco.

## Technical Context

**Language/Version**: TypeScript strict; Next.js 16.2.6 App Router; React 19.2.4; Node runtime.

**Primary Dependencies**: Drizzle ORM + postgres-js (Supabase Postgres), Zod v4, Clerk, Tailwind
v4. Sem novas dependências.

**Storage**: Postgres (Supabase). Tabelas **existentes** `pgr`, `pgr_ges`, `pgr_revisions`
(migration `0012`); RLS `app_runtime` já ativa. **Nenhuma migration; nenhuma alteração de schema.**

**Testing**: Jest — unit (jsdom) + integração (`--selectProjects integration`, node) contra
**Postgres efêmero** `INTEGRATION_*`. Validação REST por cURL (harness REST-via-Jest com 500
pré-existente). Playwright MCP previsto (bloqueável por Clerk).

**Target Platform**: Web (SSR/App Router) + REST `/api/v1/*`.

**Project Type**: Web app multi-tenant (SST SaaS).

**Performance Goals**: consolidada montada em **poucas queries em lote** (sem N+1); demais
interações CRUD sub-segundo.

**Constraints**: isolamento multi-tenant (`withOrg`+RLS); tenant sempre da sessão; zero-migration;
revisões **append-only** e **sem autor** persistido (ator no audit); medidas **sem status
persistido** (estado derivado); consolidada **read-only** (sem persistir, sem PDF).

**Scale/Scope**: 3 domínios + 3 repositórios + 3 grupos de Server Actions + 4 route handlers REST +
editor em abas (1 página + ~6 componentes) + docs/Postman + unit & integração.

## Constitution Check

*GATE — reavaliado após o design (Phase 1).*

| Princípio | Situação nesta fatia |
| --- | --- |
| **I — Isolamento multi-tenant** | ✅ `withOrg(orgId)` + RLS `app_runtime`; `assertPgrInTenant`/`assertGesInTenant`; tenant de `requireOfficeStaff()`/contexto, nunca do client. |
| **II — Serviço externo pago** | ✅ N/A (sem LLM/serviço pago). |
| **Camadas (page→action→domain→repo→drizzle)** | ✅ Repositórios são os únicos a tocar Drizzle; actions/handlers reusam repo/zod. |
| **Superfície de API (Action + REST + docs + Postman)** | ✅ As 4 entregas juntas para cada CRUD (GES-link, revisões) + REST GET consolidada. |
| **Testabilidade (unit + integração Postgres efêmero)** | ✅ Unit (ordenação/estado derivado/validação) + integração (CRUD/RLS) contra `INTEGRATION_*`. |
| **Zero migration / schema code-first** | ✅ Tabelas/enums já existem (0012); nada em `schema/**` ou `migrations/**`. |

**Resultado do gate**: PASS. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
.specs/019-pgr-consolidated-view/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/{repositories,server-actions,rest-endpoints}.md
├── checklists/requirements.md   # (do /speckit-specify)
└── tasks.md                     # (Phase 2 — /speckit-tasks)
```

### Source Code (repository root)

```text
src/shared/domains/pgr/
├── pgr-ges.ts            # NOVO — schema de vínculo (gesId)
├── pgr-revision.ts       # NOVO — schema de revisão (revisionNumber/revisedAt/notes)
└── pgr-consolidated.ts   # NOVO — tipos da consolidada + sort puro + reuso deriveMeasureState

src/shared/db/repositories/
├── pgr-ges.ts            # NOVO — withOrg + assertPgr/assertGes + list/add/remove
├── pgr-revisions.ts      # NOVO — withOrg + assertPgr + list/create (append-only)
└── pgr-consolidated.ts   # NOVO — read-only; composição em lote (sem N+1)

src/shared/server/actions/pgr/
├── pgr-ges.ts            # NOVO — list/add/remove (officeAction, audit em write)
├── pgr-revisions.ts      # NOVO — list/create (officeAction, audit em create)
└── pgr-consolidated.ts   # NOVO — get (officeAction read)

src/app/api/v1/pgr/[id]/
├── ges/route.ts              # NOVO — GET list + POST add (201)
├── ges/[gesId]/route.ts      # NOVO — DELETE remove vínculo (204)
├── revisions/route.ts        # NOVO — GET list + POST create (201)
└── consolidated/route.ts     # NOVO — GET consolidada (200)

src/app/(protected)/pgr/[id]/
├── page.tsx                  # EDIT — vira o editor com abas
└── _components/              # NOVO — pgr-editor-tabs + abas (basic/ges/revisions/consolidated) + placeholders

docs/api/api-design.md · docs/api/sst-manager.postman_collection.json   # EDIT

src/__tests__/unit/domains/pgr/pgr-consolidated.test.ts        # NOVO (+ pgr-revision se útil)
src/__tests__/integration/pgr-editor/{pgr-ges,pgr-revisions,pgr-consolidated,rest-pgr-editor}.test.ts  # NOVO
```

**Structure Decision**: associação `pgr_ges` espelha `epi-risk` (assert de ambas as pontas → insert
com UNIQUE → DUPLICATE; delete físico do vínculo); revisões espelham um create/list simples;
consolidada é um **repository read-only** que compõe em memória o resultado de repos existentes
(risks/assessments/measures) com estado derivado.

## Complexity Tracking

Sem violações de constituição. Tabela vazia.

## Fora do escopo (reafirmado)

Migration `0016`; alteração de schema; **GED** (upload/storage/download/URL assinada/tabela de
documentos); **cor da capa / sumário** persistidos; **aceite** persistido; **autor** persistido de
revisão; **status** manual de medidas; snapshot de `risk_level`/`result`; **PDF** da Fase 05;
alteração em `control_measures`/`risk_methodology`; IA/recomendação. **Update/Delete de revisão**
(append-only). GED e Cor/Sumário só como **placeholder desabilitado**.

## Formatação / gates finais

`format:check` final **obrigatório**; Prettier **dirigido** nos arquivos da feature; **não**
formatar repo-wide às cegas. Ao falhar, **separar**: (a) falhas reais da feature (corrigir), (b)
ruído CRLF pré-existente (ignorar — CI-LF não acusa), (c) arquivos fora do escopo. `CLAUDE.md` já
está limpo (corrigido na 018) — só reformatar se a feature o tocar.
