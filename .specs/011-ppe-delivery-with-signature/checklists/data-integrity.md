# Checklist de Qualidade de Requisitos: Integridade Transacional

**Purpose**: Validar que os requisitos de atomicidade, baixa de estoque e consistência de saldo estão
completos, claros e mensuráveis — ANTES da implementação.
**Created**: 2026-06-27
**Feature**: [spec.md](../spec.md) · [data-model.md](../data-model.md)
**Depth**: Standard · **Audience**: Reviewer (PR) / Author

> Estes itens testam a **qualidade dos requisitos**, não o comportamento do código.

## Requirement Completeness

- [ ] CHK001 - O requisito de atomicidade da confirmação (movimento + baixa + mudança de status numa única transação) está documentado? [Completeness, Spec §FR-006]
- [ ] CHK002 - Está especificado que cada item entregue gera **exatamente um** movimento de saída vinculado à entrega? [Completeness, Spec §SC-004]
- [ ] CHK003 - O requisito de aviso de quantidade mínima após a baixa (sem bloquear) está definido? [Completeness, Spec §FR-008]
- [ ] CHK004 - O invariante "saldo só muda por movimentações" e a reconciliação histórico↔saldo estão registrados? [Completeness, Data-model §Invariantes]

## Requirement Clarity

- [ ] CHK005 - "Rollback total" está definido sem ambiguidade (lista do que NÃO deve persistir)? [Clarity, Spec §FR-006/SC-003]
- [ ] CHK006 - O momento da baixa (na confirmação, não na criação) está expresso de forma inequívoca? [Clarity, Spec §FR-016]
- [ ] CHK007 - A regra de quantidade (sempre inteira e positiva; sinal vem do tipo de movimento) está clara? [Clarity, Spec §FR-003]

## Requirement Consistency

- [ ] CHK008 - "Saldo nunca negativo" é consistente entre validação na aplicação e a constraint do banco (backstop)? [Consistency, Spec §FR-007]
- [ ] CHK009 - O mapeamento item-selecionado (`stockId`) → item-armazenado (`catalog_id`) é descrito de forma consistente entre spec, data-model e contratos? [Consistency, Data-model]
- [ ] CHK010 - A descrição da baixa na confirmação é consistente entre o caminho manual e o público? [Consistency, Spec §FR-006]

## Acceptance Criteria Quality

- [ ] CHK011 - Os critérios de sucesso de integridade (SC-002/003/004) são objetivamente mensuráveis? [Measurability, Spec §SC-002..004]
- [ ] CHK012 - Existe critério verificável para "a entrega só é assinada se a baixa ocorrer" (e vice-versa)? [Measurability, Spec §FR-006]

## Scenario Coverage

- [ ] CHK013 - Cenário de saldo insuficiente em **um** item de uma entrega multi-item (recusa + rollback) está coberto? [Coverage, Spec §Edge Cases]
- [ ] CHK014 - Cenário de duas entregas concorrentes do mesmo item (serialização) está como requisito? [Coverage, Spec §Edge Cases]
- [ ] CHK015 - Cenário de confirmação concorrente da mesma entrega (idempotência) está coberto na ótica de integridade? [Coverage, Spec §Edge Cases]

## Edge Case Coverage

- [ ] CHK016 - Há requisito sobre itens duplicados no payload da entrega (rejeição)? [Edge Case, Spec §Edge Cases]
- [ ] CHK017 - O comportamento quando o saldo cai exatamente a zero (limite) está endereçado? [Edge Case, Gap]
- [ ] CHK018 - Está definido que `delivery_date` é data (sem hora) e que o movimento herda essa data? [Edge Case, Spec §Edge Cases/Data-model]

## Dependencies & Assumptions

- [ ] CHK019 - A dependência do padrão transacional da fatia 010 (lock + validação) está documentada como reuso? [Dependency, Research D7]
- [ ] CHK020 - A premissa "zero migration" (modelo 008 suficiente) está registrada e validada para a baixa por entrega? [Assumption, Plan]

## Ambiguities & Conflicts

- [ ] CHK021 - Algum requisito de integridade depende de termo não quantificado (ex.: "consistente", "atômico") sem critério verificável? [Ambiguity]
