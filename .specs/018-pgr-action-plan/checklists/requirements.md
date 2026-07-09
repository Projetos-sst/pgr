# Specification Quality Checklist: Medidas de controle e plano de ação do risco (5W2H)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-09
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

> Nota: nomes reais de tabela/colunas/enum (`control_measures`, `control_level`, campos `action_*`)
> e códigos de erro aparecem como **invariantes de contrato aprovados no Gate 0**, não como escolha
> de implementação — são restrições de negócio/dados desta fatia (zero migration sobre modelo
> existente), por decisão explícita do time.

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- P1-1 (obrigatoriedade dos campos 5W2H) resolvida na entrada do specify: `action_what` +
  `action_how` obrigatórios quando `applicable=true`; demais opcionais. Refletida em FR-004 e nos
  cenários da US1/US3.
- Decisões do Gate 0 validadas contra o schema real: UNIQUE `(org_id, risk_id, control_level)` →
  DUPLICATE/409 real; sem enum de status → estados derivados; `action_responsible` texto →
  combobox grava nome como texto; nível de risco derivado da avaliação vigente (sem snapshot).
- Zero migration: nenhum item requer alteração de schema ou `migrations/**`.
- Dívida `CLAUDE.md` (format:check) registrada para os gates finais da feature.
