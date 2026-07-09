# Specification Quality Checklist: Avaliação de Risco — Probabilidade × Severidade (matriz 5×5)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-08
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

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

- Gate 0 (auditoria read-only) confirmou: a tabela **`risk_assessments`** já existe (migration
  `0012`) com RLS/GRANT/trigger/CHECKs e **sem UNIQUE** (→ histórico 1:N, sem 409); a **metodologia
  5×5** (`risk_methodology`, migration `0013`, #76) já está mergeada e é consumida via
  `getRiskMethodologyView`/`classify` com fallback padrão; o **CRUD de riscos** (#24, PR #135) está
  em `develop`; o seed de integração já semeia `riskAssessmentA`/`riskAssessmentB` para cenários
  cross-tenant. Todas as 8 decisões aprovadas do Gate 0 estão refletidas no cabeçalho e nos FRs.
- **Zero-migration** é afirmado no cabeçalho, nas Assumptions e nas restrições de escopo.
- A spec referencia nomes de artefatos concretos (`risk_assessments`, `risk_methodology`,
  `domains/pgr/methodology.ts`, migrations `0012`/`0013`) no cabeçalho/assumptions **para travar o
  escopo**, por ser continuação de uma fatia de modelo de dados — espelhando as specs aceitas 013/014.
  As histórias e FRs permanecem focados em resultado.
- Divergências da issue #25 (`avaliacoes_risco`, `organization_id`, SQLite, `features/pgr/`) estão
  explicitamente resolvidas em favor do modelo/padrão real do projeto.
- A hierarquia de controles / plano 5W2H (`control_measures`) é a issue **#26** e está fora do escopo.
- Nenhum item incompleto. Pronto para `/speckit-plan`.
