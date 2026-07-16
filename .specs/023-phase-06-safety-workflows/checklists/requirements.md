# Specification Quality Checklist: Fase 06 — Ordens de Serviço, Incidentes, Planos de Ação e Auditorias

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-16
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details leaking into WHAT/WHY beyond as-approved Gate 0 invariants (padrões como `withOrg`/`officeAction` aparecem como invariantes de arquitetura já decididas, não como escolha em aberto)
- [x] Focused on user value and business needs (fluxo operacional de SST pós-PGR)
- [x] Written for stakeholders técnicos + PO (idioma pt-BR, padrão do repo)
- [x] All mandatory sections completed (User Scenarios, Requirements, Success Criteria)

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable (15 SCs com metas 100%/0-linhas/asserção de shape)
- [x] Success criteria are technology-agnostic where it matters (outcomes, não detalhes internos)
- [x] All acceptance scenarios are defined (Given/When/Then por user story)
- [x] Edge cases are identified (concorrência, replay, origem removida, IA off, client, `db:migrate` sujo)
- [x] Scope is clearly bounded (seção Out of Scope explícita)
- [x] Dependencies and assumptions identified (seções Assumptions + Dependências e riscos)

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria (FR-001..FR-045 mapeadas às US)
- [x] User scenarios cover primary flows (7 user stories = 7 issues)
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification beyond as-approved invariants

## Cobertura das sete issues (mapa issue → user story)

- [x] `#41` — Modelo de dados (OS, Incidentes, Planos) → **US1** (FR-001..FR-006) + tabelas em FR-007/009/021/031/037
- [x] `#42` — CRUD de Ordem de Serviço → **US2** (FR-007..FR-015)
- [x] `#44` — Workflow e assinatura digital da OS → **US3** (FR-016..FR-020)
- [x] `#45` — CRUD de Incidente/Acidente → **US4** (FR-021..FR-026)
- [x] `#87` — Ciclo de vida dos incidentes → **US5** (FR-027..FR-030)
- [x] `#91` — CRUD de Plano de Ação 5W2H → **US6** (FR-031..FR-036)
- [x] `#93` — Riscos e Auditorias em kanban com IA → **US7** (FR-037..FR-043)

## Decisões de escopo fechadas (Gate 0 sobre a develop atual)

- [x] Uma única spec/branch/diretório (não sete) — `feature/phase-06-safety-workflows` / `.specs/023-phase-06-safety-workflows/`
- [x] Migration única **`0024_phase_06_safety_workflows`** (idx 24) — corrigido de 0019
- [x] Reconciliação do histórico de migrations = pré-requisito **P0 da US1**, registrado (FR-002), sem corrigir na spec
- [x] Cinco tabelas novas nomeadas e com campos mínimos definidos
- [x] Numeração da OS por lock de linha do tenant, consecutiva, sem lock global (FR-008, SC-001/002)

## Privacidade e dado de saúde (P0)

- [x] Incidentes restritos a office staff; `client` → FORBIDDEN 403 (FR-025, SC-008)
- [x] Dado de saúde nunca em logs/audit/payload público/IA/fixtures/Postman real (FR-026, invariante 2)
- [x] Payload público da OS congelado e sem PII sensível (FR-018, SC-006)
- [x] IA recebe apenas contexto não-PII (FR-042)

## Fotos, CAT e origens

- [x] Fotos = apenas placeholder; sem upload/base64/bucket/SDK novo (FR-024) — fora da V1
- [x] CAT = registro interno; códigos opcionais e textuais; sem lookup oficial e **sem emissão S-2210** (FR-022) — eSocial fora da V1
- [x] Origens de plano/auditoria = `origin_type` **TEXT validada**, apenas `risk|incident` na V1; `inspection`/`non_conformity` fora, plugáveis sem migration (FR-032/037)

## Reuso de infraestrutura

- [x] Assinatura genérica reutilizada (target_type `service_order`, zero migration, +1 nos 3 registries `demo|inspection|pgr`, cota compartilhada) (FR-016/017)
- [x] IA opcional e degradável; novo `kind` `action_plan_suggestion` = zero migration (`ai_usage_events.kind` é text) (FR-041/043, SC-012)
- [x] `control_measures` permanece distinta e intacta (FR-035)

## Entregáveis de API (4 superfícies)

- [x] Server Action + REST mirror + docs/api-design.md + Postman exigidos por recurso (FR-044/045, SC-015)
- [x] Recursos REST enumerados: service-orders, accidents, action-plans, risk-audits, service-order signature

## Ausência de ambiguidade

- [x] Nenhuma tabela/coluna/rota/enum/provider inventado além do aprovado
- [x] Nenhum `[NEEDS CLARIFICATION]` no spec.md
- [x] Nenhuma decisão em aberto que bloqueie `/speckit-plan`

## Notes

- Todas as decisões P1 do Gate 0 estão fechadas: `origin_type` TEXT risk|incident; CAT interno sem S-2210; fotos placeholder; IA sem migration; assinatura genérica; migration 0024; journal como pré-requisito P0 da US1. Invariante P0 de dado de saúde ratificado (invariantes 2 e 6).
- Pré-requisito de implementação a carregar para o `/speckit-plan`: **conferir `drizzle.__drizzle_migrations` e reconciliar o histórico (2 órfãos `0018_*`, tag `0018_schedule_events` sem `.sql`, `schedule_events` duplicado) antes de gerar a `0024`** (FR-002) — sem corrigir nesta spec.
