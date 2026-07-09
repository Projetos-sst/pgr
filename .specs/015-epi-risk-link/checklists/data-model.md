# Checklist: Qualidade dos requisitos de integridade do modelo de dados

**Purpose**: Validar se os requisitos de migration/enum/constraints e a evolução `ges_id → risk_id`
estão inequívocos, cobrem os edge cases de exclusão e preservam as garantias herdadas da 008.
**Created**: 2026-07-08
**Feature**: [spec.md](../spec.md) · **Foco**: integridade de dados (Princípio V — banco fonte de verdade)

## Requirement Completeness

- [ ] CHK001 - O requisito de repontar o vínculo de `ges_id` para `risk_id → risks.id` está declarado, com o unique correspondente `(org, catalog_id, risk_id)`? [Completeness, Spec §FR-002 + §FR-007]
- [ ] CHK002 - Há requisito de que a neutralização é um **conjunto fechado de 3 estados** (enum), explicitamente **não** booleano nem texto livre? [Completeness, Spec §FR-003]
- [ ] CHK003 - Está especificado que a migration em `ALTER` **preserva** GRANT/`app_runtime`, trigger `set_updated_at` e policy `epi_risk_isolation` da 008? [Completeness, data-model.md §Migration]
- [ ] CHK004 - Os comportamentos `ON DELETE` de `risk_id` e `catalog_id` (ambos CASCADE) estão especificados junto aos seus edge cases? [Coverage, Spec Edge Cases]

## Requirement Clarity

- [ ] CHK005 - A regra de unicidade do par e o erro resultante (`DUPLICATE`, SQLSTATE 23505) estão claros? [Clarity, Spec §FR-007]
- [ ] CHK006 - Está claro que a neutralização **não tem default** e deve ser escolhida na criação (coerente com "obrigatória")? [Clarity, Spec §FR-001 + data-model.md]
- [ ] CHK007 - Os requisitos deixam inequívoco que o alvo é `risks` (não mais `ges`)? [Clarity, Spec §FR-002]

## Dependencies & Assumptions

- [ ] CHK008 - A premissa de **tabela vazia sem consumidores** (sem migração de dados) está documentada, com a ressalva de estratégia caso existam linhas? [Assumption, Spec Assumptions]
- [ ] CHK009 - A dependência/risco de numeração da migration (`0013` colide com `0013_risk_methodology` do #136) está registrada como follow-up de rebase? [Dependency, research.md §D6]
- [ ] CHK010 - A decisão de exclusão **física** vs soft delete (histórico) está declarada como assunção revisitável (OS futura)? [Assumption, Spec §D3]

## Scenario & Edge Case Coverage

- [ ] CHK011 - Excluir o **risco** e excluir o **item de catálogo** têm ambos requisito de remoção em cadeia do vínculo? [Coverage, Spec Edge Cases]
- [ ] CHK012 - Os valores do enum e seus rótulos pt-BR (Sim/Não/Não Aplicável) estão especificados de forma consistente entre data-model e UI? [Consistency, data-model.md]
