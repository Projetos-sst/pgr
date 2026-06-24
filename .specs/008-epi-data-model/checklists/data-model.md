# Data Model Requirements Quality Checklist: Modelo de dados do módulo de EPIs

**Purpose**: Validar a **qualidade dos requisitos** de modelagem de dados (completude, clareza,
consistência, mensurabilidade e cobertura) na spec — não a implementação. Uso: gate de revisão
de PR antes de implementar.
**Created**: 2026-06-22
**Feature**: [spec.md](../spec.md)

**Note**: Itens são "unit tests for English" — testam se os requisitos estão bem escritos, não
se o código funciona.

## Requirement Completeness (entidades, campos, relações)

- [ ] CHK001 - Todos os campos do ePGR para o catálogo estão enumerados explicitamente na spec (tipo, categoria, CA, validade do CA, fabricante, norma, tamanho, unidade de medida, descrição, foto)? [Completeness, Spec §FR-001]
- [ ] CHK002 - Cada uma das 6 entidades tem seus campos, tipos e obrigatoriedade documentados? [Completeness, Spec §Key Entities]
- [ ] CHK003 - As relações (FKs) entre as 6 tabelas e com `categories`/`employees`/`ges` estão todas declaradas? [Completeness, Spec §Key Entities]
- [ ] CHK004 - Os 2 enums novos (tipo de movimento; status de assinatura) têm o conjunto completo de membros listado? [Completeness, Spec §FR-005/§FR-007]
- [ ] CHK005 - A alteração aditiva exigida em `categories` (UNIQUE de suporte à FR-002a) está registrada como requisito/assunção? [Gap, Spec §FR-002a]
- [ ] CHK006 - Os índices necessários (em `org_id` e nas FKs) estão referidos como requisito, ou ficam implícitos? [Gap]

## Requirement Clarity (termos quantificados / sem ambiguidade)

- [ ] CHK007 - "Único globalmente" para o token de assinatura está definido sem ambiguidade (escopo global vs por tenant)? [Clarity, Spec §FR-008]
- [ ] CHK008 - A unidade de medida está claramente definida como texto livre opcional (sem lista fixa)? [Clarity, Spec §FR-001]
- [ ] CHK009 - "Saldo materializado" está distinguido de "saldo derivado" e a responsabilidade de manutenção (Fase 2) está explícita? [Clarity, Spec §Assumptions]
- [ ] CHK010 - O significado de "tenant ativo" (escritório = orgs.id, da sessão) está inequívoco e diferenciado de empresa-cliente? [Clarity, Spec §FR-016]
- [ ] CHK011 - O caráter "interino" da relação `epi_risk → ges` está descrito com a condição de migração futura? [Clarity, Spec §Assumptions]

## Requirement Consistency (alinhamento entre seções)

- [ ] CHK012 - O requisito de consistência de tipo (FR-002a) é coerente com a entidade do catálogo e com os edge cases? [Consistency, Spec §FR-002a/§Key Entities/§Edge Cases]
- [ ] CHK013 - As regras de ON DELETE descritas nos requisitos batem com as descritas nos edge cases (RESTRICT/CASCADE/SET NULL)? [Consistency, Spec §FR-011..015/§Edge Cases]
- [ ] CHK014 - A terminologia das entidades é usada de forma uniforme entre User Stories, Requirements e Key Entities? [Consistency]
- [ ] CHK015 - O escopo global do token (FR-008) é consistente com o Princípio de isolamento (FR-016) sem contradição aparente? [Consistency, Spec §FR-008/§FR-016]

## Acceptance Criteria Quality (mensurabilidade)

- [ ] CHK016 - Os Success Criteria são objetivamente verificáveis (ex.: "100% das tabelas isoladas", "quantidade ≤ 0 sempre rejeitada")? [Measurability, Spec §SC-001..006]
- [ ] CHK017 - Cada Functional Requirement tem um critério de aceite/cenário rastreável que o torne testável? [Measurability, Spec §FR-*]
- [ ] CHK018 - "Nenhum dado cruza tenants" está expresso de forma mensurável (leitura e escrita, com dois tenants)? [Measurability, Spec §SC-002]

## Scenario & Edge Case Coverage

- [ ] CHK019 - Há requisito para o cenário de exclusão de categoria em uso (bloqueio)? [Coverage, Spec §FR-011/§Edge Cases]
- [ ] CHK020 - Há requisito para exclusão de catálogo **com histórico de entregas** (bloqueio por RESTRICT)? [Coverage, Spec §FR-012]
- [ ] CHK021 - Há requisito para a preservação do movimento ao excluir a entrega (SET NULL)? [Coverage, Spec §FR-015/§Edge Cases]
- [ ] CHK022 - Há requisito para a cadeia de exclusão (catálogo→estoque→movimentos; entrega→itens; funcionário→entregas)? [Coverage, Spec §FR-013/§FR-014]
- [ ] CHK023 - Há requisito para coexistência de múltiplos `auth_token` nulos vs token preenchido único? [Coverage, Spec §FR-008/§Edge Cases]
- [ ] CHK024 - Há requisito para item "máquina" sem CA/validade/norma (campos condicionais vazios)? [Coverage, Spec §FR-003/§Edge Cases]
- [ ] CHK025 - Há requisito para rejeição de valor fora do conjunto dos enums? [Coverage, Spec §Edge Cases]

## Non-Functional & Constitution Alignment

- [ ] CHK026 - O requisito de "banco como fonte de verdade" (constraints) está explícito e alinhado ao Princípio V? [Completeness, Spec §FR-017]
- [ ] CHK027 - O requisito de origem do tenant ("sempre da sessão, nunca do cliente") está declarado conforme o Princípio I? [Consistency, Spec §FR-016]
- [ ] CHK028 - O requisito de testes (unit + integração em Postgres efêmero, nunca SQLite) está expresso como critério de conclusão? [Completeness, Spec §SC-007]

## Dependencies & Assumptions

- [ ] CHK029 - A dependência de `categories`/`employees`/`ges` (006) está documentada como pré-requisito? [Dependency, Spec §Assumptions]
- [ ] CHK030 - A assunção de que o saldo e o fluxo de assinatura/QR são da Fase 2 está validada e fora de escopo? [Assumption, Spec §Assumptions]
- [ ] CHK031 - A dívida técnica (`epi_risk → ges` interino; futura tabela `risks`) está registrada como assunção rastreável? [Assumption, Spec §Assumptions]

## Ambiguities & Conflicts

- [ ] CHK032 - Existe algum termo de "tamanho/quantidade/limite" usado sem definição mensurável nos requisitos? [Ambiguity]
- [ ] CHK033 - Há conflito entre "sem alterar tabelas existentes" (briefing/§12) e a alteração aditiva de `categories` exigida pela FR-002a? [Conflict, Spec §FR-002a]
- [ ] CHK034 - Existe esquema de IDs de requisito/critério (FR-/SC-) consistente para rastreabilidade? [Traceability, Spec §Requirements/§Success Criteria]

## Notes

- Marque itens como `[x]` ao validar; anote a evidência (seção da spec) inline.
- Itens com `[Gap]`/`[Conflict]` apontam possível ajuste na spec antes de prosseguir.
- Pontos já levantados no `/speckit-analyze`: CHK020 (≈G1), CHK021 (≈G2), CHK033 (≈I1).
