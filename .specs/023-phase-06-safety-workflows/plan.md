# Implementation Plan: Fase 06 — Ordens de Serviço, Incidentes/Acidentes, Planos de Ação 5W2H e Auditorias

**Branch**: `feature/phase-06-safety-workflows` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/023-phase-06-safety-workflows/spec.md` (7 US · 45 FR · 15 SC · 0 NEEDS CLARIFICATION)

## Summary

Entregar o fluxo operacional de SST pós-PGR em **uma migration estrutural** (`0024_phase_06_safety_workflows`) com 5 tabelas tenant-isoladas (`service_orders`, `service_order_items`, `accidents`, `action_plans`, `risk_audits`) e as camadas domain/repository/action/REST/UI por cima, reusando integralmente a infra genérica de **assinatura** (target `service_order`, zero migration) e de **IA** (kind `action_plan_suggestion`, zero migration). O **primeiro bloco é bloqueante**: reconciliar o histórico de migrations (2 órfãos `0018_*`, tag `0018_schedule_events` sem arquivo, `schedule_events` duplicado) antes de gerar a `0024`. Nenhum código é escrito nesta fase de planejamento.

## Technical Context

**Language/Version**: TypeScript strict · Next.js 16.2.6 (App Router) · React 19.2.4 · Node runtime.

**Primary Dependencies**: Drizzle ORM + `postgres` (postgres-js) sobre Supabase Postgres · Clerk (auth) · Zod v4 · Tailwind v4 · `@anthropic-ai/sdk` (IA existente) · `qrcode` + `signature_pad` (assinatura existente).

**Storage**: Supabase Postgres. Runtime = role `app_runtime` via pooler (6543, `prepare:false, max:1`); `drizzle-kit` = conexão owner unpooled. RLS por tenant em todas as tabelas novas.

**Testing**: Jest (unit jsdom + integration node contra **Postgres efêmero** `INTEGRATION_DATABASE_URL`/`INTEGRATION_APP_RUNTIME_URL`, `--runInBand`, **nunca** SQLite). Playwright (público sempre; protegido quando Clerk disponível). cURL para REST.

**Target Platform**: Web (SaaS B2B multiempresa).

**Project Type**: Web app monolítica em camadas (`src/app/**` → `src/shared/server/**` → `src/shared/domains/**` → `src/shared/db/repositories/**` → `src/shared/db/schema/**`).

**Performance Goals**: interativo padrão web; numeração de OS serializada por tenant sem lock global; listagens paginadas (offset, pageSize 20/máx 100).

**Constraints**: isolamento multi-tenant não-negociável; dado de saúde P0 (nunca em log/payload/IA/fixture); assinatura/IA reusadas sem nova tabela/cota; CAT interno (sem S-2210); `origin_type` TEXT `risk|incident`; `control_measures` intacto; migration única `0024`.

**Scale/Scope**: 5 tabelas · ~6 enums · 4 recursos REST + assinatura protegida da OS · ~14 rotas de UI · 7 user stories.

## Constitution Check

_Constituição v1.5.0. GATE: passar antes da Fase 0 e reavaliar após a Fase 1._

| Princípio                                        | Avaliação                                                                                                                                                                                     | Veredito             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **I. Isolamento Multi-Tenant (não-negociável)**  | 5 tabelas com `org_id text NOT NULL → orgs.id`, RLS `USING`+`WITH CHECK` p/ `app_runtime`, GRANTs; acesso só via `withOrg`; tenant da sessão. `service_order_items` carrega `org_id` próprio. | ✅ PASS              |
| **II. Stack Fixa e Simplicidade**                | Sem serviço externo pago novo. IA Anthropic já autorizada (emenda 1.3.0). Assinatura/IA reusadas. Nenhuma dependência nova.                                                                   | ✅ PASS (sem emenda) |
| **III. Integridade de dados / DB como backstop** | Constraints no banco (UNIQUE, CHECK, UNIQUE parcial da auditoria), FKs, RLS backstop; escrita via `auditedTenantWrite`.                                                                       | ✅ PASS              |
| **IV. Testes (unit + integração em PG efêmero)** | Unit p/ regras puras; integração p/ Actions/REST, RLS, cross-tenant, concorrência — contra Postgres efêmero.                                                                                  | ✅ PASS              |
| **V. Segredos / privacidade**                    | Chaves server-only; dado de saúde P0 fora de log/payload/IA; payload público congelado; token só hasheado.                                                                                    | ✅ PASS              |

**Constitution Check (pós-Fase 1)**: reavaliado após data-model/contracts — sem novas violações; `origin_type` TEXT e reuso de assinatura/IA mantêm os princípios. ✅

**Complexity Tracking**: sem violações a justificar (tabela vazia).

## Project Structure

### Documentation (this feature)

```text
.specs/023-phase-06-safety-workflows/
├── plan.md                       # este arquivo
├── research.md                   # decisões (journal, numeração, origin_type, status incidente, IA, limites payload)
├── data-model.md                 # 5 tabelas: colunas, enums, FKs, índices, UNIQUEs, RLS
├── quickstart.md                 # como rodar/testar a fatia
└── contracts/
    ├── repositories.md           # assinaturas dos repositórios
    ├── server-actions.md         # Server Actions (officeAction → ActionResult<T>)
    └── rest-endpoints.md         # Route Handlers REST (restHandler) + docs/Postman
# tasks.md NÃO é criado por /speckit-plan
```

### Source Code (repository root) — arquivos previstos (a criar na implementação)

```text
src/shared/db/schema/
├── service-orders.ts        # service_orders + service_order_items + enum service_order_status
├── accidents.ts             # accidents + enums accident_type/category/severity/status
├── action-plans.ts          # action_plans + enum action_plan_status (origin_type é TEXT, não enum)
├── risk-audits.ts           # risk_audits + enum risk_audit_status (origin_type TEXT)
└── index.ts                 # (barrel) re-export das novas tabelas

src/shared/db/migrations/
└── 0024_phase_06_safety_workflows.sql   # gerada por drizzle-kit APÓS reconciliação (Bloco A)

src/shared/domains/safety/          # namespace dedicado da Fase 06 (espelha domains/inspections)
├── service-order.ts          # zod input+item (source_type; description ≤500), regras de exclusão/estado, snapshot
├── accident.ts               # zod input, enums, campos CAT internos
├── incident-lifecycle.ts     # ÚNICA fonte das transições de status do incidente (regras puras)
├── action-plan.ts            # zod 5W2H, status, overdue derivado, validação de origem
├── risk-audit.ts             # zod, transições do kanban, unicidade de ativa por origem
└── action-plan-suggestion.ts # input sanitizado (allowlist não-PII) + output 5W2H (IA)
src/shared/domains/signatures/targets/
└── service-order.ts          # payload público congelado (.strict(); ≤100 itens, description ≤500)

src/shared/ui/signature/
└── ServiceOrderSignatureForm.tsx  # + entrada em signatureFormRegistry

src/shared/db/repositories/
├── service-orders.ts         # CRUD + numeração server-side + itens transacionais
├── accidents.ts              # CRUD + transições de status
├── action-plans.ts           # CRUD + validação de origem + advance do incidente
├── risk-audits.ts            # CRUD + unicidade de ativa + transições
└── service-order-signature.ts# source/estado derivado da assinatura da OS

src/shared/server/actions/safety/    # Actions da Fase 06 (namespace próprio, NÃO sob pgr)
├── service-orders.ts  service-order-signature.ts  accidents.ts  action-plans.ts  risk-audits.ts
src/shared/server/safety/            # cores (espelha server/pgr/*-core.ts)
├── service-order-signature-core.ts   # adaptador sobre createSignatureRequestCore
└── action-plan-suggestion-core.ts    # orquestra IA (quota + fallback)

src/app/(protected)/                 # UI (seguir design system 019: globals.css + _ui restilizados)
├── service-orders/**  incidents/**  action-plans/**  risk-audits/**
├── _components/nav-menu.tsx        # registrar rotas da Fase 06 no mega-menu do shell 019
src/app/api/v1/
├── service-orders/**  incidents/**  action-plans/**  risk-audits/**   # REST mirrors
```

**Structure Decision**: monolito em camadas já existente (padrão das fatias 007–022). Repositórios são os **únicos** a tocar Drizzle; Actions/handlers nunca. Nomes de arquivos seguem o padrão real (`companies.ts`, `pgr-revisions.ts`). `origin_type` é **coluna TEXT validada na aplicação** (não pgEnum), habilitando `inspection`/`non_conformity` futuros sem migration. A Fase 06 usa um **namespace dedicado `safety`** (`domains/safety/`, `server/safety/`, `server/actions/safety/`) espelhando o padrão de módulo próprio de `inspections`/`esocial` — **nada** novo sob `pgr`; os repositórios seguem o padrão **plano** em `db/repositories/`. A UI segue o **design system da fatia 019** (tokens em `globals.css`, primitives `_ui` restilizadas) e registra suas rotas no **mega-menu** do shell (`app/(protected)/_components/nav-menu.tsx`), não numa "sidebar" avulsa. Rotas em inglês (`service-orders`, `incidents`, `action-plans`, `risk-audits`) alinhadas à renomeação PT→EN do PR #174.

## Blocos de implementação (verdes, incrementais)

> Cada bloco fecha com **gate direcionado** (testes do bloco + typecheck + lint dos arquivos tocados). O **gate completo** só no final (Bloco G). Commits sugeridos são _Conventional Commits_.

### Bloco A — Reconciliação de migrations + schema/RLS (BLOQUEANTE)

- **Escopo**: FR-001, FR-002, FR-003. Auditar/reconciliar o journal **antes** de gerar a `0024`; criar os 4 arquivos de schema; gerar a `0024` por `drizzle-kit`; RLS/GRANT/triggers como SQL custom.
- **Pré-requisito P0** (ver `research.md` §1): (1) confirmado que o helper de integração **glob-a `.sql`** (não usa o journal) → testes efêmeros verdes hoje; o risco é o caminho `drizzle-kit migrate`/deploy. (2) inspecionar `drizzle.__drizzle_migrations` no ambiente real autorizado. (3) comparar journal × arquivos × snapshots. (4) correção mínima compatível com banco existente **e** novo. (5) validar em PG efêmero limpo. (6) só então `db:generate` da `0024`.
- **Pré-decisões (P2) a fechar ANTES de gerar a `0024`** (nenhum tipo indefinido na migration): (i) fixar o conjunto fechado de `accident_category`; (ii) definir `priority` como `smallint` **ou** pgEnum; (iii) decidir a UNIQUE parcial de `risk_audits` via `uniqueIndex().where()` do Drizzle **vs.** `CREATE UNIQUE INDEX … WHERE` custom; (iv) documentar o acoplamento **unidirecional** `action_plans → incident-lifecycle` (planos avançam o incidente, nunca o inverso).
- **Arquivos**: `schema/service-orders.ts`, `schema/accidents.ts`, `schema/action-plans.ts`, `schema/risk-audits.ts`, `schema/index.ts`, `migrations/0024_*` (+ meta), ajustes de reconciliação do journal/arquivos.
- **Dependências**: nenhuma (é a base).
- **Testes direcionados**: integração de migration/RLS/`WITH CHECK`/enums/UNIQUEs/UNIQUE parcial/isolamento tenant A-B; `db:migrate` limpo pós-reconciliação (SC-013, SC-014).
- **Critério de conclusão**: 5 tabelas com RLS real; `npm run test:integration` (subset schema) verde; `drizzle-kit` não re-emite billing/is_master.
- **Bloqueia**: **todo** o resto (nenhuma alteração de schema antes deste bloco fechar).
- **Commit**: `feat(db): add phase-06 safety schema + reconcile migration journal (0024)`

### Bloco B — CRUD de OS + itens

- **Escopo**: US2 (FR-007..FR-015). Domain/repo/action/REST/UI de `service_orders`+itens; numeração server-side; itens transacionais; snapshots; exclusão protegida; cross-tenant.
- **Arquivos**: `domains/safety/service-order.ts`; `repositories/service-orders.ts`; `server/actions/safety/service-orders.ts`; `app/api/v1/service-orders/**`; `app/(protected)/service-orders/**`.
- **Dependências**: Bloco A.
- **Testes**: numeração concorrente (SC-001), tenants independentes (SC-002), criação/edição transacional + rollback (SC-003), snapshots, filtros/estados, exclusão protegida, employee cross-tenant→422, OS cross-tenant→404.
- **Conclusão**: CRUD completo + 4 superfícies (Action/REST/docs/Postman) da OS.
- **Commit**: `feat(service-orders): CRUD de OS e itens com numeração server-side`

### Bloco C — Workflow e assinatura da OS

- **Escopo**: US3 (FR-016..FR-020). `target_type` `service_order` nos 3 registries; payload congelado; core adaptador; Actions/REST protegido + painel; estado derivado.
- **Arquivos**: `domains/signatures/targets/service-order.ts`; `domains/signatures/contract.ts` (+1 membro); `ui/signature/form-registry.tsx` (+1) + `ServiceOrderSignatureForm.tsx`; `server/safety/service-order-signature-core.ts`; `repositories/service-order-signature.ts`; `app/api/v1/service-orders/[id]/signature/**`.
- **Dependências**: Bloco B.
- **Testes**: criação de solicitação (cota compartilhada), payload mínimo (SC-006), assinatura pública sem login (SC-004), replay/uso único (SC-005), estados derivados, itens imutáveis pós-assinatura.
- **Conclusão**: OS assinável via `/signature-requests/[token]` sem tabela/rota/cota nova.
- **Commit**: `feat(service-orders): assinatura pública reusando infra genérica`

### Bloco D — CRUD de incidentes

- **Escopo**: US4 (FR-021..FR-026). `accidents` CRUD; abas Dados/Causas/Fotos(placeholder); office-staff only; CAT interno.
- **Arquivos**: `domains/safety/accident.ts`; `repositories/accidents.ts`; `server/actions/safety/accidents.ts`; `app/api/v1/incidents/**`; `app/(protected)/incidents/**`.
- **Dependências**: Bloco A.
- **Testes**: CRUD, campos opcionais/textuais, `client`→403 (SC-008), cross-tenant→404 (SC-007), placeholder de fotos, ausência de dado de saúde em log/audit.
- **Conclusão**: registro interno de incidentes completo (sem ciclo de vida ainda).
- **Commit**: `feat(incidents): CRUD de incidentes/acidentes (registro interno)`

### Bloco E — Planos 5W2H + ciclo de vida do incidente

- **Escopo**: US6 (FR-031..FR-036) + US5 (FR-027..FR-030). `action_plans` CRUD/central multiorigem; validação de origem TEXT; overdue; cancelamento; `incident-lifecycle` como fonte única das transições; conclusão bloqueada com plano ativo; contagem de planos.
- **Arquivos**: `domains/safety/action-plan.ts` + `domains/safety/incident-lifecycle.ts`; `repositories/action-plans.ts` (+ helpers de advance do incidente na mesma transação); `server/actions/safety/action-plans.ts` + `server/actions/safety/accidents.ts` (status do incidente); `app/api/v1/action-plans/**` + `incidents/[id]/status`; `app/(protected)/action-plans/**` + `incidents/management`.
- **Dependências**: Blocos A, D.
- **Testes**: 5W2H, origem válida/inválida/cross-tenant→422 (SC-010), status/overdue/cancelamento, origem removida→histórico, incidente não conclui com plano ativo (SC-009), atualização de status do incidente sem lógica duplicada.
- **Conclusão**: planos multiorigem + ciclo de vida do incidente integrados.
- **Commit**: `feat(action-plans): planos 5W2H multiorigem + ciclo de vida do incidente`

### Bloco F — Auditorias/Kanban + IA

- **Escopo**: US7 (FR-037..FR-043). `risk_audits` list/get/create/transition; unicidade de ativa por origem; kanban por Actions; sugestão IA `action_plan_suggestion`.
- **Arquivos**: `domains/safety/risk-audit.ts` + `domains/safety/action-plan-suggestion.ts`; `repositories/risk-audits.ts`; `server/actions/safety/risk-audits.ts` + `server/safety/action-plan-suggestion-core.ts`; `app/api/v1/risk-audits/**` (+ `suggest-action-plan`); `app/(protected)/risk-audits/**`.
- **Dependências**: Blocos A, E.
- **Testes**: uma ativa por origem (SC-011), transições+justificativa, vínculo a planos, IA **mockada**, cota free/pro, degradação graciosa (SC-012).
- **Conclusão**: kanban + IA opcional funcionando; CRUD independe da IA.
- **Commit**: `feat(risk-audits): kanban de auditorias + sugestão 5W2H por IA`

### Bloco G — Docs/Postman + testes manuais + gates finais

- **Escopo**: FR-044/FR-045, SC-014/SC-015. Sincronizar `docs/api/api-design.md` + Postman; cURL; Playwright público/protegido; gate completo.
- **Arquivos**: `docs/api/api-design.md`, `docs/api/sst-manager.postman_collection.json`, specs Playwright.
- **Dependências**: Blocos B–F.
- **Gate completo**: `format` + `lint` + `typecheck` + `unit` + `integration --runInBand` + `build` + cURL + Playwright + docs/Postman sincronizados + diff schema/migrations esperado.
- **Commit**: `docs(api): registra recursos da Fase 06 (design + Postman) + gates`

## Riscos (resumo; detalhe em research.md)

- **P0 journal**: reconciliação incorreta corrompe deploy/`drizzle-kit migrate`. Mitigação: evidência de `drizzle.__drizzle_migrations` antes de tocar arquivos/journal; validar em PG efêmero.
- **P0 dado de saúde**: vazamento por log/payload/IA/fixture. Mitigação: invariantes 2/6 + asserção de shape + allowlist de IA.
- **P1 duplicação de lógica de status do incidente**: mitigada por `incident-lifecycle.ts` como fonte única.
- **P2 payload público da OS**: crescimento além do congelado. Mitigação: schema `.strict()` + limite de itens (research.md §6) + teste de shape.
