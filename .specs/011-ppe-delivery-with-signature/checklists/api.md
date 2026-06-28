# Checklist de Qualidade de Requisitos: API & Contratos

**Purpose**: Validar que os requisitos de endpoints (internos + públicos), mapa de erros e validação de
payload estão completos, claros e consistentes — ANTES da implementação.
**Created**: 2026-06-27
**Feature**: [spec.md](../spec.md) · [contracts/](../contracts/)
**Depth**: Standard · **Audience**: Reviewer (PR) / Author

> Estes itens testam a **qualidade dos requisitos**, não o comportamento do código.

## Requirement Completeness

- [ ] CHK001 - Todos os endpoints (criar entrega, assinar manual, status, carregar por token, confirmar por token) têm contrato documentado? [Completeness, Contracts]
- [ ] CHK002 - O payload de criação de entrega está totalmente especificado (campos, tipos, obrigatoriedade)? [Completeness, Spec §FR-003]
- [ ] CHK003 - As respostas de sucesso (forma do retorno) estão definidas para cada endpoint? [Completeness, Contracts]
- [ ] CHK004 - O contrato distingue claramente endpoints internos (`/api/v1`) dos públicos (`/api/public`)? [Completeness, Contracts]

## Requirement Clarity

- [ ] CHK005 - Cada código de erro tem mapeamento HTTP inequívoco (VALIDATION→422, NOT_FOUND→404, FORBIDDEN→403, ALREADY_SIGNED→409, TOKEN_EXPIRED→410, INSUFFICIENT_STOCK→422)? [Clarity, Contracts/Research D8]
- [ ] CHK006 - O parâmetro de método de assinatura no caminho público (`qr`|`link`) está claramente restrito a valores válidos? [Clarity, Contracts]
- [ ] CHK007 - O critério de paginação/busca da listagem de itens entregáveis está descrito? [Clarity, Contracts]

## Requirement Consistency

- [ ] CHK008 - Os nomes de rota são consistentes entre spec, plan, contratos e tasks (`/epi-deliveries`, `/sign/[token]`, `/api/public/...`)? [Consistency]
- [ ] CHK009 - Os códigos de erro novos (ALREADY_SIGNED, TOKEN_EXPIRED) são consistentes entre contratos, regras de erro e a fonte de mapeamento HTTP? [Consistency, Contracts]
- [ ] CHK010 - O endpoint de status (polling) é consistente com o requisito de "aguardando confirmação"? [Consistency, Spec §FR-012]

## Acceptance Criteria Quality

- [ ] CHK011 - Para cada endpoint, os resultados esperados (códigos e efeitos) são objetivamente verificáveis? [Measurability, Contracts]
- [ ] CHK012 - Os contratos do caminho público têm critério explícito de isolamento (não vazar outras orgs)? [Measurability, Spec §SC-005]

## Scenario Coverage

- [ ] CHK013 - Cada endpoint documenta seus modos de falha (4xx) além do caminho feliz? [Coverage, Contracts]
- [ ] CHK014 - O contrato cobre a confirmação idempotente (segunda chamada → conflito)? [Coverage, Spec §Edge Cases]
- [ ] CHK015 - Há cobertura de contrato para criação com item sem saldo na validação de disponibilidade? [Coverage, Spec §FR-006]

## Edge Case Coverage

- [ ] CHK016 - O contrato define a resposta para token inexistente, expirado e já usado de forma distinta? [Edge Case, Contracts]
- [ ] CHK017 - Há requisito para rejeitar payload com `stockId` duplicado? [Edge Case, Spec §FR-003]

## Non-Functional (API)

- [ ] CHK018 - Há requisito de validação por schema **antes** de tocar o banco em toda action/handler (incl. público)? [NFR, Constituição §V]
- [ ] CHK019 - Há requisito de `no-store` para os recursos públicos? [NFR, Contracts]
- [ ] CHK020 - O versionamento da API interna (`/api/v1`) é mantido e os públicos seguem convenção separada? [NFR, Contracts]

## Dependencies & Assumptions

- [ ] CHK021 - A dependência do `restHandler`/`officeAction` existentes para padronizar respostas está registrada? [Assumption, Plan]

## Ambiguities & Conflicts

- [ ] CHK022 - Algum contrato deixa resposta/efeito implícito (sem código HTTP ou forma de retorno definidos)? [Ambiguity]
