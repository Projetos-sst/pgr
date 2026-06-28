# Checklist de Qualidade de Requisitos: Fluxo & UX (wizard)

**Purpose**: Validar que os requisitos de fluxo (seleção→revisão→autenticação), estados de tela e
página pública estão completos, claros e consistentes — ANTES da implementação.
**Created**: 2026-06-27
**Feature**: [spec.md](../spec.md) · [quickstart.md](../quickstart.md)
**Depth**: Standard · **Audience**: Reviewer (PR) / Author

> Estes itens testam a **qualidade dos requisitos**, não o comportamento do código.

## Requirement Completeness

- [ ] CHK001 - O fluxo de 3 passos (seleção, revisão, autenticação) está descrito por requisitos, com o que cada passo recebe e produz? [Completeness, Spec §US1]
- [ ] CHK002 - Os três métodos de assinatura (QR, link, manual) têm requisitos de comportamento distintos descritos? [Completeness, Spec §FR-005]
- [ ] CHK003 - O requisito do painel "Aguardando confirmação…" (e como ele reflete a confirmação) está documentado? [Completeness, Spec §FR-012]
- [ ] CHK004 - O conteúdo da tela pública (itens, quantidades, funcionário, data, ação de confirmar) está especificado? [Completeness, Spec §FR-009]
- [ ] CHK005 - O comportamento quando o funcionário não tem e-mail/telefone ("Enviar Link" indisponível → orientar cadastro) está definido? [Completeness, Spec §FR-018/US3]

## Requirement Clarity

- [ ] CHK006 - O critério de quais EPIs aparecem na seleção (somente saldo > 0) está claro e quantificado? [Clarity, Spec §FR-002/SC-006]
- [ ] CHK007 - A regra de habilitar o campo Quantidade só após selecionar o item está descrita sem ambiguidade? [Clarity, Spec §US1]

## Requirement Consistency

- [ ] CHK008 - A terminologia (entrega, item, método de assinatura, confirmação) é usada de forma consistente entre as histórias e os passos? [Consistency]
- [ ] CHK009 - A página pública (sem sidebar/login) é descrita de forma consistente com o caminho interno (com login)? [Consistency, Spec §FR-009]

## Scenario Coverage (estados de tela)

- [ ] CHK010 - Há requisitos para o **estado vazio** (nenhum EPI com saldo para entregar)? [Coverage, Edge Case, Gap]
- [ ] CHK011 - Há requisitos para o **estado de erro** ao confirmar (ex.: saldo insuficiente exibido ao usuário)? [Coverage, Spec §FR-008]
- [ ] CHK012 - Há requisito para o **estado de espera** (enquanto o funcionário não confirma o QR)? [Coverage, Spec §FR-012]
- [ ] CHK013 - A tela pública define o que mostrar quando o token é inválido/expirado/já usado? [Coverage, Spec §Edge Cases]

## Edge Case Coverage

- [ ] CHK014 - Está especificado o que acontece se o gestor tentar entregar quantidade maior que o disponível (feedback na UI)? [Edge Case, Spec §Edge Cases]
- [ ] CHK015 - O aviso de "abaixo da mínima" tem requisito de apresentação (não bloqueante) ao usuário? [Edge Case, Spec §FR-008]

## Non-Functional (UX)

- [ ] CHK016 - O alvo de tempo do fluxo (< 2 min) está definido de forma mensurável? [Measurability, Spec §SC-001]
- [ ] CHK017 - Há requisito de idioma/localização (rótulos pt-BR) e de acessibilidade mínima dos formulários? [NFR, Gap]
- [ ] CHK018 - Há requisito sobre persistência/estado do wizard ao navegar entre passos (sem perda de seleção)? [NFR, Gap]

## Dependencies & Assumptions

- [ ] CHK019 - A premissa de reuso dos primitives de UI existentes (`_ui/form`, `_ui/list`) está registrada? [Assumption, Plan]
- [ ] CHK020 - A suposição de que a ficha de impressão manual é opcional/fora do MVP está documentada? [Assumption, Spec §Assumptions]

## Ambiguities & Conflicts

- [ ] CHK021 - Algum elemento de UX permanece descrito por adjetivo vago (ex.: "simples", "intuitivo") sem critério? [Ambiguity]
